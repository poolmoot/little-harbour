import { button, item, section, slider, textField } from '../components';
import { icon } from '../icons';
import { GUIDE } from '../guideText';
import { CONSENT, MENU, SETTINGS } from '../menuText';
import { NAME_LABEL, QUALITY_CHOICES, QUALITY_NOTE, QUALITY_TITLE } from '../text';
import type { Screen } from './types';

/** Volumes and mute, picture quality, and reset game. Opened from the title screen and the pause menu. */
export const settingsScreen: Screen = ({ state, audio, quality, confirmReset, guideTips = true, consent = 'none' }) => {
  const harbour = item({
    title: NAME_LABEL.harbour,
    sub: SETTINGS.harbourNote,
    right: textField({ id: 'harbourname', value: state.harbourName, label: NAME_LABEL.harbour, save: 'renameharbour', saveLabel: NAME_LABEL.save }),
  });
  const volumes = SETTINGS.volumes.map(([id, name, note]) => item({
    title: name,
    sub: note,
    right: slider({ id, value: audio[id], label: name, off: audio.muted }),
  })).join('');
  const mute = item({
    title: SETTINGS.soundSwitch,
    sub: SETTINGS.soundSwitchNote,
    right: button({ label: audio.muted ? SETTINGS.off : SETTINGS.on, act: 'mute', tone: audio.muted ? 'ghost' : 'go', size: 'sm' }),
  });
  const picture = item({
    title: QUALITY_CHOICES.find(([k]) => k === quality)?.[1] ?? '',
    sub: QUALITY_NOTE,
    right: QUALITY_CHOICES.map(([k, name]) => button({ label: name, act: 'quality', a: k, tone: quality === k ? 'go' : 'ghost', size: 'sm' })).join(''),
  });
  const tips = item({
    title: GUIDE.settingsTitle,
    sub: GUIDE.settingsNote,
    right: button({ label: guideTips ? SETTINGS.on : SETTINGS.off, act: 'guidetips', tone: guideTips ? 'go' : 'ghost', size: 'sm' }),
  });
  const data = consent === 'none' ? '' : section(CONSENT.settingsTitleSection) + item({
    title: CONSENT.settingsTitle,
    sub: CONSENT.settingsNote,
    right: button({ label: consent === 'granted' ? SETTINGS.on : SETTINGS.off, act: 'consent', tone: consent === 'granted' ? 'go' : 'ghost', size: 'sm' }),
  });
  const reset = confirmReset
    ? item({
      title: SETTINGS.resetAsk,
      right: `<span class="row-x">${button({ label: SETTINGS.resetYes, act: 'resetyes', tone: 'danger', size: 'sm' })}${button({ label: SETTINGS.resetNo, act: 'resetno', tone: 'ghost', size: 'sm' })}</span>`,
    })
    : item({
      title: SETTINGS.resetTitle,
      sub: SETTINGS.resetNote,
      right: button({ label: SETTINGS.resetButton, act: 'reset', tone: 'danger', size: 'sm' }),
    });
  return {
    title: MENU.settings,
    icon: icon('gear', 28),
    menu: true,
    body: section(SETTINGS.harbourTitle) + harbour + section(SETTINGS.sound) + mute + volumes + section(QUALITY_TITLE) + picture + section(GUIDE.helpTitle) + tips + data + section(SETTINGS.resetTitle) + reset,
    foot: `${button({ label: MENU.back, act: 'menuback', tone: 'info', size: 'sm' })}<span class="dim">Esc</span>`,
  };
};
