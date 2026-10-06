'use client'

import GameCodeModal from '@/components/GameCodeModal'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import GameModeSelector from '@/components/dashboards/GameModeSelector'
import PlaySteps from '@/components/teacher/play/PlaySteps'
import GameDurationPicker from '@/components/teacher/play/GameDurationPicker'
import RoomCodePanel from '@/components/teacher/play/RoomCodePanel'
import HomeworkPanel, { HostModeToggle } from '@/components/teacher/play/HomeworkPanel'
import StudyOptionsFields from '@/components/teacher/play/StudyOptionsFields'
import ZombieOptionsFields from '@/components/teacher/play/ZombieOptionsFields'
import RaidOptionsFields from '@/components/teacher/play/RaidOptionsFields'
import WaitingRoomPanel from '@/components/teacher/play/WaitingRoomPanel'
import GameControlBar from '@/components/teacher/play/GameControlBar'
import CreateRoomPanel from '@/components/teacher/play/CreateRoomPanel'
import LiveDashboardRenderer from '@/components/dashboards/LiveDashboardRenderer'
import TeacherBgmControl from '@/components/teacher/TeacherBgmControl'
import { useTeacherPlayRoom } from '@/hooks/useTeacherPlayRoom'

/**
 * 선생님 "게임 시작" 화면. 방 상태와 진행 규칙은 useTeacherPlayRoom 훅이 맡고,
 * 여기서는 방이 있는지·상태가 무엇인지에 따라 어떤 패널을 보여줄지만 정한다.
 */
export default function TeacherDashboard() {
  const {
    roomCode,
    room,
    roomStatus,
    players,
    ownerId,
    questionSets,
    selectedSetId,
    selectedSet,
    setsLoading,
    setsError,
    activeSetLabel,
    gameMode,
    activeModeConfig,
    hostMode,
    setHostMode,
    timedDurationMinutes,
    setTimedDurationMinutes,
    studySettings,
    setStudySettings,
    zombieSettings,
    setZombieSettings,
    raidSettings,
    setRaidSettings,
    isGameStarted,
    timerDisplaySeconds,
    inviteUrl,
    showGameCodeModal,
    setShowGameCodeModal,
    showStartTutorial,
    tutorialStepIndex,
    hideTutorialNextTime,
    setHideTutorialNextTime,
    setTutorialStep,
    handleGameModeChange,
    handleCreateGame,
    handleConfirmStart,
    handleStartButtonClick,
    handleStartFromTutorial,
    handleCloseStartTutorial,
    handleEndGame,
    handlePauseGame,
    handleResumeGame,
    handleResetGame,
    handleCopyInvite,
  } = useTeacherPlayRoom()

  return (
    <div>
      <h1 className="mb-5 text-4xl font-black tracking-tight text-slate-900">게임 시작</h1>

      <PlaySteps
        hasRoom={Boolean(roomCode)}
        roomStatus={room?.status}
        requiresQuestionSet={activeModeConfig.requiresQuestionSet}
        hasSelectedSet={Boolean(selectedSetId)}
        playerCount={players.length}
      />

      {/* 실시간 수업 / 과제로 내기 */}
      {!roomCode && <HostModeToggle value={hostMode} onChange={setHostMode} />}
      {!roomCode && hostMode === 'homework' && (
        <HomeworkPanel
          questionSets={questionSets}
          selectedSetId={selectedSetId}
          setsLoading={setsLoading}
          setsError={setsError}
          ownerId={ownerId}
        />
      )}

      {/* 방 설정 (실시간 수업) */}
      <div className={`mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${!roomCode && hostMode === 'homework' ? 'hidden' : ''}`}>

        {/* 게임 모드 선택 */}
        {!roomCode && (
          <GameModeSelector
            selectedMode={gameMode}
            onSelectMode={handleGameModeChange}
          />
        )}

        {/* 공부 모드 옵션 — 방을 만들기 전에 정한다 */}
        {!roomCode && gameMode === 'study' && (
          <div className="mb-6">
            <StudyOptionsFields value={studySettings} onChange={setStudySettings} context="live" />
          </div>
        )}

        {roomCode ? (
          <div className="space-y-4">
            <GameDurationPicker minutes={timedDurationMinutes} onChange={setTimedDurationMinutes} />

            {gameMode === 'zombie' && roomStatus === 'waiting' && (
              <ZombieOptionsFields value={zombieSettings} onChange={setZombieSettings} />
            )}

            {gameMode === 'raid' && roomStatus === 'waiting' && (
              <RaidOptionsFields value={raidSettings} onChange={setRaidSettings} />
            )}

            {roomStatus !== 'finished' && <TeacherBgmControl />}

            <RoomCodePanel
              roomCode={roomCode}
              roomStatus={roomStatus}
              inviteUrl={inviteUrl}
              modeConfig={activeModeConfig}
              playerCount={players.length}
              activeSetLabel={activeSetLabel}
              timerDisplaySeconds={timerDisplaySeconds}
              onShowLargeCode={() => setShowGameCodeModal(true)}
              onCopyInvite={handleCopyInvite}
            />

            {roomStatus === 'waiting' && (
              <WaitingRoomPanel players={players} onStart={handleStartButtonClick} />
            )}

            {/* 코드 크게 보기 버튼은 없앴다. 위 참가코드 패널의 QR을 누르면 같은 모달이 열린다. */}
            {isGameStarted && (
              <GameControlBar
                isPaused={roomStatus === 'paused'}
                onPause={handlePauseGame}
                onResume={handleResumeGame}
                onEnd={handleEndGame}
                onReset={handleResetGame}
              />
            )}
          </div>
        ) : (
          <CreateRoomPanel
            requiresQuestionSet={activeModeConfig.requiresQuestionSet}
            selectedSet={selectedSet}
            hasSelectedSet={Boolean(selectedSetId)}
            setsLoading={setsLoading}
            setsError={setsError}
            onCreate={handleCreateGame}
          />
        )}
      </div>

      {/* 게임 모드에 따른 표시 또는 통계 화면 */}
      {roomCode && room && room.status !== 'waiting' && (
        <div className="font-bitbit">
          <LiveDashboardRenderer room={room} players={players} />
        </div>
      )}

      {!roomCode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="font-medium text-slate-500">게임을 만들면 참가자 목록이 여기에 표시돼요</p>
        </div>
      )}

      {/* 게임 코드 모달 */}
      <GameCodeModal
        roomCode={roomCode}
        isOpen={showGameCodeModal}
        onClose={() => setShowGameCodeModal(false)}
        onStartGame={handleConfirmStart}
        onCopy={() => {
          // 복사 완료 시 추가 동작 (선택적)
        }}
      />

      <div className="font-bitbit">
        <GameStartTutorialModal
          gameMode={gameMode}
          isOpen={showStartTutorial}
          stepIndex={tutorialStepIndex}
          role="teacher"
          hideNextTime={hideTutorialNextTime}
          onHideNextTimeChange={setHideTutorialNextTime}
          onStepChange={setTutorialStep}
          onStart={handleStartFromTutorial}
          onClose={handleCloseStartTutorial}
        />
      </div>

    </div>
  )
}
