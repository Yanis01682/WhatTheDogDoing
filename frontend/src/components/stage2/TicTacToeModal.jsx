const terminalStatuses = new Set(['x_win', 'o_win', 'draw', 'cancelled'])

function getGameTitle(game, currentUserId) {
  if (!game) return '井字棋'
  if (game.status === 'pending') {
    return currentUserId === game.inviterId ? '等待好友应战' : '好友邀请你对弈'
  }
  if (game.status === 'active') {
    return game.turnUserId === currentUserId ? '轮到你落子' : '等待对方落子'
  }
  if (game.status === 'draw') return '平局'
  if (game.status === 'cancelled') return '棋局已取消'
  return game.winnerUserId === currentUserId ? '你赢了' : '对方获胜'
}

function TicTacToeModal({
  game,
  currentUserId,
  visible,
  onClose,
  onAccept,
  onMove,
  onResign,
  onInviteAgain,
}) {
  if (!visible || !game) return null

  const currentMark = currentUserId === game.xUserId ? 'X' : 'O'
  const isInvitee = currentUserId === game.inviteeId
  const canAccept = game.status === 'pending' && isInvitee
  const canMove = game.status === 'active' && game.turnUserId === currentUserId
  const isTerminal = terminalStatuses.has(game.status)
  const board = game.board || Array(9).fill('.')

  return (
    <div className="ttt-overlay" onClick={onClose}>
      <div className="ttt-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ttt-header">
          <div>
            <p className="ttt-kicker">Aegis 井字棋</p>
            <h3>{getGameTitle(game, currentUserId)}</h3>
          </div>
          <button className="ttt-close" type="button" onClick={onClose}>×</button>
        </div>

        <div className="ttt-players">
          <div className={`ttt-player ${currentMark === 'X' ? 'self' : ''}`}>
            <span className="ttt-mark">X</span>
            <span>{game.xName}</span>
          </div>
          <div className={`ttt-player ${currentMark === 'O' ? 'self' : ''}`}>
            <span className="ttt-mark">O</span>
            <span>{game.oName}</span>
          </div>
        </div>

        <div className="ttt-board" aria-label="井字棋棋盘">
          {board.map((cell, index) => (
            <button
              key={index}
              type="button"
              className={`ttt-cell ${cell !== '.' ? 'filled' : ''}`}
              disabled={!canMove || cell !== '.'}
              onClick={() => onMove(game.id, index)}
            >
              {cell === '.' ? '' : cell}
            </button>
          ))}
        </div>

        <div className="ttt-footer">
          {game.status === 'pending' && !canAccept && <span>邀请已发出，对方同意后开局。</span>}
          {game.status === 'active' && <span>你执 {currentMark}，{canMove ? '选择一格落子。' : '请等对方行动。'}</span>}
          {isTerminal && <span>这局已经结束，可以退出，也可以再邀请对方一局。</span>}
          <div className="ttt-actions">
            {canAccept && <button type="button" className="ttt-primary" onClick={() => onAccept(game.id)}>接受对局</button>}
            {isTerminal && <button type="button" className="ttt-primary" onClick={onInviteAgain}>再邀请</button>}
            {isTerminal && <button type="button" className="ttt-secondary" onClick={onClose}>退出</button>}
            {!isTerminal && <button type="button" className="ttt-danger" onClick={() => onResign(game.id)}>{game.status === 'pending' ? '取消' : '退出棋局'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TicTacToeModal
