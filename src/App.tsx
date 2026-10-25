import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { CreateHubView } from './components/CreateHubView';
import { ShelfView } from './components/ShelfView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { ChatView } from './components/ChatView';
import { NovelStudioView } from './components/NovelStudioView';
import { CharacterModal } from './components/CharacterModal';
import { WorldBookModal } from './components/WorldBookModal';
import { PresetModal } from './components/PresetModal';
import { NewStoryModal } from './components/NewStoryModal';
import { TRPGView } from './components/TRPG/TRPGView';
import { TRPGNewSessionModal } from './components/TRPG/TRPGNewSessionModal';
import { DialogueModeView } from './components/Dialogue/DialogueModeView';
import {
  CharacterCard,
  WorldBook,
  SystemPreset,
  StorySave,
  AppSettings,
  ActiveNavTab,
  UserMask,
  StoryMode,
  TRPGSession,
} from './types';
import {
  loadTRPGSessions,
  saveSingleTRPGSession,
  getActiveTRPGSessionId,
  setActiveTRPGSessionId,
} from './utils/trpgStorage';
import {
  loadCharacters,
  saveCharacters,
  loadWorldBooks,
  saveWorldBooks,
  loadPresets,
  savePresets,
  loadSaves,
  saveSaves,
  loadSettings,
  saveSettings,
  getActiveSaveId,
  setActiveSaveId,
  saveSingleStory,
  deleteSaveById,
  loadUserMasks,
  saveUserMasks,
  getActiveUserMaskId,
  setActiveUserMaskId,
} from './utils/storage';
import {
  DEFAULT_CHARACTERS,
  DEFAULT_WORLDBOOLS,
  DEFAULT_PRESETS,
} from './utils/defaultData';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('home');
  const [activeSaveIdState, setActiveSaveIdState] = useState<string | null>(getActiveSaveId());

  // Data states
  const [characters, setCharacters] = useState<CharacterCard[]>(() => loadCharacters());
  const [worldbooks, setWorldbooks] = useState<WorldBook[]>(() => loadWorldBooks());
  const [presets, setPresets] = useState<SystemPreset[]>(() => loadPresets());
  const [saves, setSaves] = useState<StorySave[]>(() => loadSaves());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [userMasks, setUserMasks] = useState<UserMask[]>(() => loadUserMasks());
  const [activeUserMaskId, setActiveUserMaskIdState] = useState<string | null>(() => getActiveUserMaskId());

  // TRPG states
  const [trpgSessions, setTrpgSessions] = useState<TRPGSession[]>(() => loadTRPGSessions());
  const [activeTRPGSessionIdState, setActiveTRPGSessionIdState] = useState<string | null>(() => getActiveTRPGSessionId());
  const [isNewTRPGModalOpen, setIsNewTRPGModalOpen] = useState(false);

  // Dialogue Mode state (GPT/Gemini/DeepSeek 风格自由对话模式)
  const [isDialogueModeActive, setIsDialogueModeActive] = useState(false);

  const handleOpenTRPGSession = (sessionId: string) => {
    setActiveTRPGSessionIdState(sessionId);
    setActiveTRPGSessionId(sessionId);
  };

  const handleExitTRPGSession = () => {
    setActiveTRPGSessionIdState(null);
    setActiveTRPGSessionId(null);
  };

  const handleUpdateTRPGSession = (updated: TRPGSession) => {
    const nextSessions = trpgSessions.map((s) => (s.id === updated.id ? updated : s));
    setTrpgSessions(nextSessions);
    saveSingleTRPGSession(updated);
  };

  const handleTRPGSessionCreated = (newSession: TRPGSession) => {
    const nextSessions = [newSession, ...trpgSessions];
    setTrpgSessions(nextSessions);
    setActiveTRPGSessionIdState(newSession.id);
    setActiveTRPGSessionId(newSession.id);
  };

  // Modals state
  const [isNewStoryModalOpen, setIsNewStoryModalOpen] = useState(false);
  const [newStoryInitialMode, setNewStoryInitialMode] = useState<StoryMode>('single');

  const [charModalOpen, setCharModalOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterCard | null>(null);

  const [worldBookModalOpen, setWorldBookModalOpen] = useState(false);
  const [selectedWorldBook, setSelectedWorldBook] = useState<WorldBook | null>(null);

  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SystemPreset | null>(null);

  // Sync active save ID with local storage
  const handleOpenSave = (saveId: string) => {
    setActiveSaveIdState(saveId);
    setActiveSaveId(saveId);
  };

  const handleExitChat = () => {
    setActiveSaveIdState(null);
    setActiveSaveId(null);
  };

  // Character handlers
  const handleSaveCharacter = (char: CharacterCard) => {
    const index = characters.findIndex((c) => c.id === char.id);
    let next: CharacterCard[];
    if (index >= 0) {
      next = [...characters];
      next[index] = char;
    } else {
      next = [char, ...characters];
    }
    setCharacters(next);
    saveCharacters(next);
  };

  const handleDeleteCharacter = (id: string) => {
    const next = characters.filter((c) => c.id !== id);
    setCharacters(next);
    saveCharacters(next);
  };

  // Worldbook handlers
  const handleSaveWorldBook = (wb: WorldBook) => {
    const index = worldbooks.findIndex((w) => w.id === wb.id);
    let next: WorldBook[];
    if (index >= 0) {
      next = [...worldbooks];
      next[index] = wb;
    } else {
      next = [wb, ...worldbooks];
    }
    setWorldbooks(next);
    saveWorldBooks(next);
  };

  const handleDeleteWorldBook = (id: string) => {
    const next = worldbooks.filter((w) => w.id !== id);
    setWorldbooks(next);
    saveWorldBooks(next);
  };

  // Preset handlers
  const handleSavePreset = (preset: SystemPreset) => {
    const index = presets.findIndex((p) => p.id === preset.id);
    let next: SystemPreset[];
    if (index >= 0) {
      next = [...presets];
      next[index] = preset;
    } else {
      next = [preset, ...presets];
    }
    setPresets(next);
    savePresets(next);
  };

  const handleDeletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  // Save / Story handlers
  const handleCreateStory = (newSave: StorySave) => {
    const nextSaves = [newSave, ...saves];
    setSaves(nextSaves);
    saveSaves(nextSaves);
    handleOpenSave(newSave.id);
  };

  const handleUpdateStorySave = (updated: StorySave) => {
    const nextSaves = saves.map((s) => (s.id === updated.id ? updated : s));
    setSaves(nextSaves);
    saveSingleStory(updated);
  };

  const handleDeleteSave = (id: string) => {
    deleteSaveById(id);
    setSaves((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSaves(next);
      return next;
    });
    if (activeSaveIdState === id) {
      setActiveSaveIdState(null);
    }
  };

  const handleRenameSave = (id: string, newTitle: string) => {
    const nextSaves = saves.map((s) => (s.id === id ? { ...s, title: newTitle } : s));
    setSaves(nextSaves);
    saveSaves(nextSaves);
  };

  const handleImportSave = (save: StorySave) => {
    const nextSaves = [save, ...saves];
    setSaves(nextSaves);
    saveSaves(nextSaves);
    handleOpenSave(save.id);
  };

  const handleDuplicateSave = (save: StorySave) => {
    const duplicated: StorySave = {
      ...save,
      id: `save-${Date.now()}`,
      title: `${save.title} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: save.stats ? JSON.parse(JSON.stringify(save.stats)) : [],
      messages: save.messages ? JSON.parse(JSON.stringify(save.messages)) : [],
      config: { ...save.config },
    };
    const nextSaves = [duplicated, ...saves];
    setSaves(nextSaves);
    saveSaves(nextSaves);
    saveSingleStory(duplicated);
  };

  // Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // User Mask handlers
  const handleSaveUserMask = (mask: UserMask) => {
    const index = userMasks.findIndex((m) => m.id === mask.id);
    let next: UserMask[];
    if (index >= 0) {
      next = [...userMasks];
      next[index] = mask;
    } else {
      next = [mask, ...userMasks];
    }
    setUserMasks(next);
    saveUserMasks(next);
    if (!activeUserMaskId) {
      setActiveUserMaskIdState(mask.id);
      setActiveUserMaskId(mask.id);
    }
  };

  const handleDeleteUserMask = (id: string) => {
    const next = userMasks.filter((m) => m.id !== id);
    setUserMasks(next);
    saveUserMasks(next);
    if (activeUserMaskId === id) {
      const nextActive = next[0]?.id || null;
      setActiveUserMaskIdState(nextActive);
      setActiveUserMaskId(nextActive);
    }
  };

  const handleSwitchUserMask = (id: string) => {
    setActiveUserMaskIdState(id);
    setActiveUserMaskId(id);
  };

  // Reset defaults
  const handleResetDefaults = () => {
    setCharacters([]);
    saveCharacters([]);
    setWorldbooks(DEFAULT_WORLDBOOLS);
    saveWorldBooks(DEFAULT_WORLDBOOLS);
    setPresets(DEFAULT_PRESETS);
    savePresets(DEFAULT_PRESETS);
    setUserMasks([]);
    saveUserMasks([]);
    setActiveUserMaskIdState(null);
    setActiveUserMaskId(null);
    alert('已重置配置（自带角色卡与玩家面具已清空，保留默认世界书与预设模板）！');
  };

  // Active story save for ChatView / TRPGView
  const currentActiveSave = saves.find((s) => s.id === activeSaveIdState);
  const currentActiveTRPGSession = trpgSessions.find((s) => s.id === activeTRPGSessionIdState);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans selection:bg-sky-200 selection:text-sky-900">
      {/* If in TRPG Mode, render TRPGView */}
      {currentActiveTRPGSession ? (
        <TRPGView
          session={currentActiveTRPGSession}
          worldbooks={worldbooks}
          presets={presets}
          settings={settings}
          characterCards={characters}
          onExit={handleExitTRPGSession}
          onUpdateSession={handleUpdateTRPGSession}
        />
      ) : isDialogueModeActive ? (
        <DialogueModeView
          settings={settings}
          onExit={() => setIsDialogueModeActive(false)}
        />
      ) : currentActiveSave ? (
        currentActiveSave.mode === 'novel' ? (
          <NovelStudioView
            save={currentActiveSave}
            characters={characters}
            worldbooks={worldbooks}
            presets={presets}
            settings={settings}
            onBack={handleExitChat}
            onUpdateSave={handleUpdateStorySave}
          />
        ) : (
          <ChatView
            save={currentActiveSave}
            characters={characters}
            worldbooks={worldbooks}
            presets={presets}
            userMasks={userMasks}
            activeUserMaskId={activeUserMaskId}
            settings={settings}
            onBack={handleExitChat}
            onUpdateSave={handleUpdateStorySave}
            onSavePreset={handleSavePreset}
          />
        )
      ) : (
        /* Standard Navigation Views */
        <div className="min-h-screen min-h-[100dvh] flex flex-col">
          {/* Main Content Area */}
          <main className="flex-1">
            {activeTab === 'home' && (
              <HomeView
                saves={saves}
                trpgSessions={trpgSessions}
                characters={characters}
                worldbookCount={worldbooks.length}
                presetCount={presets.length}
                onContinueSave={handleOpenSave}
                onOpenNewStoryModal={(mode) => {
                  setNewStoryInitialMode(mode || 'multi');
                  setIsNewStoryModalOpen(true);
                }}
                onOpenNewTRPGModal={() => setIsNewTRPGModalOpen(true)}
                onContinueTRPGSession={handleOpenTRPGSession}
                onOpenDialogueMode={() => setIsDialogueModeActive(true)}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'create' && (
              <CreateHubView
                characters={characters}
                worldbooks={worldbooks}
                presets={presets}
                onOpenCharacterModal={(char) => {
                  setSelectedCharacter(char);
                  setCharModalOpen(true);
                }}
                onDeleteCharacter={handleDeleteCharacter}
                onOpenWorldBookModal={(wb) => {
                  setSelectedWorldBook(wb);
                  setWorldBookModalOpen(true);
                }}
                onDeleteWorldBook={handleDeleteWorldBook}
                onOpenPresetModal={(preset) => {
                  setSelectedPreset(preset);
                  setPresetModalOpen(true);
                }}
                onDeletePreset={handleDeletePreset}
              />
            )}

            {activeTab === 'shelf' && (
              <ShelfView
                saves={saves}
                characters={characters}
                onContinueSave={handleOpenSave}
                onDeleteSave={handleDeleteSave}
                onRenameSave={handleRenameSave}
                onImportSave={handleImportSave}
                onDuplicateSave={handleDuplicateSave}
                onOpenNewStory={(mode) => {
                  setNewStoryInitialMode(mode || 'single');
                  setIsNewStoryModalOpen(true);
                }}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                settings={settings}
                characters={characters}
                worldbooks={worldbooks}
                presets={presets}
                saves={saves}
                userMasks={userMasks}
                activeUserMaskId={activeUserMaskId}
                onSaveUserMask={handleSaveUserMask}
                onDeleteUserMask={handleDeleteUserMask}
                onSwitchUserMask={handleSwitchUserMask}
                onUpdateSettings={handleUpdateSettings}
                onResetDefaults={handleResetDefaults}
              />
            )}
          </main>

          {/* Fixed Bottom Navigation */}
          <Navbar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />
        </div>
      )}

      {/* Modals */}
      <NewStoryModal
        isOpen={isNewStoryModalOpen}
        initialMode={newStoryInitialMode}
        characters={characters}
        worldbooks={worldbooks}
        presets={presets}
        userMasks={userMasks}
        activeUserMaskId={activeUserMaskId}
        onClose={() => setIsNewStoryModalOpen(false)}
        onCreateStory={handleCreateStory}
      />

      <CharacterModal
        isOpen={charModalOpen}
        character={selectedCharacter}
        onClose={() => {
          setCharModalOpen(false);
          setSelectedCharacter(null);
        }}
        onSave={handleSaveCharacter}
      />

      <WorldBookModal
        isOpen={worldBookModalOpen}
        worldBook={selectedWorldBook}
        onClose={() => {
          setWorldBookModalOpen(false);
          setSelectedWorldBook(null);
        }}
        onSave={handleSaveWorldBook}
      />

      <PresetModal
        isOpen={presetModalOpen}
        preset={selectedPreset}
        onClose={() => {
          setPresetModalOpen(false);
          setSelectedPreset(null);
        }}
        onSave={handleSavePreset}
      />

      <TRPGNewSessionModal
        isOpen={isNewTRPGModalOpen}
        onClose={() => setIsNewTRPGModalOpen(false)}
        characterCards={characters}
        worldbooks={worldbooks}
        presets={presets}
        userMasks={userMasks}
        activeUserMaskId={activeUserMaskId}
        onSessionCreated={handleTRPGSessionCreated}
      />
    </div>
  );
}
