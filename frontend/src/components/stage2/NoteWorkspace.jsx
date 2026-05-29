function NoteWorkspace({
  editingNoteId,
  noteDraft,
  setNoteDraft,
  selectedNote,
  noteCount,
  onStartNewNote,
  onSaveNote,
  onCancelNote,
}) {
  const isEditing = Boolean(editingNoteId)
  const title = editingNoteId === 'new' ? '新建誓约笔记' : selectedNote?.title || 'Aegis 笔记'
  const updatedAt = selectedNote?.updatedAt || selectedNote?.createdAt
  const formattedTime = updatedAt ? new Date(updatedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }) : ''

  return (
    <section className="chat-panel note-workspace">
      <header className="note-workspace-topbar">
        <div>
          <p className="note-workspace-kicker">Aegis Archive</p>
          <h2>{title}</h2>
          <span>{formattedTime || `${noteCount} 条骑士团记录`}</span>
        </div>
        <button type="button" className="note-new-btn" onClick={onStartNewNote}>新建</button>
      </header>

      <div className="note-workspace-body">
        {isEditing ? (
          <div className="note-workspace-editor">
            <input
              value={noteDraft.title}
              onChange={(e) => setNoteDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="为这份骑士团卷宗命名"
              maxLength={40}
              autoFocus
            />
            <textarea
              value={noteDraft.content}
              onChange={(e) => setNoteDraft((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="记录圣盾城的线索、同伴约定、下一次远征前必须完成的准备。"
            />
            <div className="note-editor-actions">
              <button type="button" onClick={onCancelNote}>取消</button>
              <button type="button" className="primary" onClick={onSaveNote}>保存</button>
            </div>
          </div>
        ) : (
          <div className="note-workspace-empty">
            <p>选择一份笔记，或开启新的 Aegis 卷宗。</p>
            <span>这里会成为右侧的大书页，用来整理世界观线索与行动备忘。</span>
            <button type="button" className="note-new-btn" onClick={onStartNewNote}>写入新记录</button>
          </div>
        )}
      </div>
    </section>
  )
}

export default NoteWorkspace
