import asyncio
import json

from app import chat


class FakeWebSocket:
    def __init__(self, fail=False):
        self.accepted = False
        self.sent = []
        self.fail = fail

    async def accept(self):
        self.accepted = True

    async def send_text(self, message):
        if self.fail:
            raise RuntimeError("closed")
        self.sent.append(message)


def test_connection_manager_sends_to_websocket_and_poll_queue():
    async def scenario():
        manager = chat.ConnectionManager()
        socket = FakeWebSocket()
        failing_socket = FakeWebSocket(fail=True)
        await manager.connect(socket, 7)
        await manager.connect(failing_socket, 7)
        queue = asyncio.Queue()
        manager.poll_queues[7] = [queue]

        payload = {"type": "conversation_updated", "conversationId": 1}
        await manager.send_notification(7, payload)

        assert socket.accepted is True
        assert json.loads(socket.sent[0]) == payload
        assert await queue.get() == payload
        assert failing_socket not in manager.active_connections[7]

        manager.disconnect(socket, 7)
        assert 7 not in manager.active_connections

    asyncio.run(scenario())


def test_connection_manager_handles_users_without_channels():
    async def scenario():
        manager = chat.ConnectionManager()
        await manager.send_notification(404, {"type": "noop"})
        await manager.notify_users([None, 404, 404], {"type": "noop"})

    asyncio.run(scenario())


def test_dispatch_notification_uses_cached_loop(monkeypatch):
    calls = []

    class FakeLoop:
        def is_running(self):
            return False

        def run_until_complete(self, coro):
            coro.close()
            calls.append("ran")

    monkeypatch.setattr(chat.ConnectionManager, "_loop", FakeLoop())

    chat._dispatch_notification([1, 1, 2], {"type": "test"})

    assert calls == ["ran"]


def test_dispatch_notification_returns_without_loop(monkeypatch):
    monkeypatch.setattr(chat.ConnectionManager, "_loop", None)
    monkeypatch.setattr(chat.asyncio, "get_running_loop", lambda: (_ for _ in ()).throw(RuntimeError()))

    chat._dispatch_notification([1], {"type": "test"})


def test_long_poll_returns_queued_notifications_and_cleans_up():
    async def scenario():
        original_queues = chat.manager.poll_queues
        chat.manager.poll_queues = {}
        try:
            task = asyncio.create_task(chat.long_poll_endpoint(88, timeout=1))
            await asyncio.sleep(0)
            queue = chat.manager.poll_queues[88][0]
            await queue.put({"type": "first"})
            await queue.put({"type": "second"})

            response = await task
            body = json.loads(response.body.decode("utf-8"))
            assert body == [{"type": "first"}, {"type": "second"}]
            assert 88 not in chat.manager.poll_queues
        finally:
            chat.manager.poll_queues = original_queues

    asyncio.run(scenario())


def test_long_poll_timeout_returns_empty_list_and_cleans_up():
    async def scenario():
        original_queues = chat.manager.poll_queues
        chat.manager.poll_queues = {}
        try:
            response = await chat.long_poll_endpoint(89, timeout=0)
            assert json.loads(response.body.decode("utf-8")) == []
            assert 89 not in chat.manager.poll_queues
        finally:
            chat.manager.poll_queues = original_queues

    asyncio.run(scenario())
