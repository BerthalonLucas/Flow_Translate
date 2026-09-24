import { describe, expect, it } from 'vitest';
import labData from '../../design-lab/src/data.js?raw';
import captureRs from '../../src-tauri/src/capture.rs?raw';
import clipboardRs from '../../src-tauri/src/clipboard_guard.rs?raw';
import libRs from '../../src-tauri/src/lib.rs?raw';
import { languages, translate } from '../i18n';
import { resolveField } from '../settings/fields';
import { errorCodes, type ErrorCode } from '../types';
import { describeError, errorCodeOf, errorFamily, noticeCause, noticeWords, refusalWords, refusedPasteCode } from './errors';

// The lab's outcomes (design-lab/src/data.js:64-73), read from its source.
type Outcome = { id: string; kind?: string; field?: string; short?: Record<'en' | 'fr', string>; action?: Record<'en' | 'fr', string> };
const start = labData.indexOf('export const OUTCOMES = [');
const outcomes = new Function(`return ${labData.slice(labData.indexOf('[', start), labData.indexOf('];', start) + 1)};`)() as Outcome[];
const outcome = (id: string) => outcomes.find(item => item.id === id)!;

// Words as a reader counts them: a number with its thousands separator is one.
const wordCount = (text: string) => text.replace(/(\d)[\s,.](?=\d{3}\b)/g, '$1').split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

describe('error codes', () => {
  it('lists the codes of lot 10 and those the audit added, each in one family', () => {
    expect(errorCodes).toEqual(['unreachable', 'timeout', 'unauthorized', 'model_not_found', 'bad_endpoint', 'busy', 'length', 'stream_broken', 'paste_blocked', 'target_changed', 'not_editable', 'too_long', 'cancelled', 'server_error', 'no_selection', 'protected_field', 'keys_held', 'internal']);
    const families = Object.fromEntries(errorCodes.map(kind => [kind, errorFamily(kind)]));
    expect(families).toEqual({
      unreachable: 'config', bad_endpoint: 'config', unauthorized: 'config', model_not_found: 'config',
      timeout: 'transient', busy: 'transient', server_error: 'transient', stream_broken: 'transient', length: 'transient', internal: 'transient',
      paste_blocked: 'paste', target_changed: 'paste', not_editable: 'paste', keys_held: 'paste',
      too_long: 'content', no_selection: 'content', protected_field: 'content',
      cancelled: 'silent',
    });
  });

  it('reads a code from the bridge, anything unknown being internal', () => {
    expect(errorCodeOf('busy')).toBe('busy');
    for (const value of ['Busy', 'http_500', '', null, undefined, 42, { kind: 'busy' }]) expect(errorCodeOf(value)).toBe('internal');
  });

  it('gives configuration errors the exact field of the Settings, for the request’s profile', () => {
    const fields: Array<[ErrorCode, string]> = [['unreachable', 'endpoint'], ['bad_endpoint', 'endpoint'], ['unauthorized', 'apiKey'], ['model_not_found', 'model']];
    for (const [kind, field] of fields) {
      expect(describeError(kind).action).toEqual({ type: 'settings', field });
      expect(describeError(kind, { mode: 'fast' }).action).toEqual({ type: 'settings', field: `fast.${field}` });
      // Both forms are identifiers of lot 13 (src/settings/fields.ts).
      expect(resolveField(field, 'quality')).toBe(`quality.${field}`);
      expect(resolveField(`fast.${field}`, 'quality')).toBe(`fast.${field}`);
    }
  });

  it('gives one button per family: Try again, Copy result, or none', () => {
    for (const kind of errorCodes) {
      const { family, action, actionLabel } = describeError(kind);
      if (family === 'transient') expect([action, actionLabel]).toEqual([{ type: 'retry' }, 'common.retry']);
      if (family === 'paste') expect([action, actionLabel]).toEqual([{ type: 'copy' }, 'result.action.copy']);
      if (family === 'content' || family === 'silent') expect([action, actionLabel]).toEqual([null, null]);
      if (family === 'config') expect(actionLabel).toMatch(/^result\.action\.(endpoint|apiKey|model)$/);
    }
  });

  it('offers no button for a capture Rust refused: nothing was read, nothing to retry or copy', () => {
    for (const code of errorCodes) {
      const { action, actionLabel, message } = describeError(code, { source: 'capture' });
      expect([action, actionLabel], code).toEqual([null, null]);
      // The request's words, but for the source window changing during the capture: nothing
      // was tried, so « not replaced » would mislead.
      expect(message, code).toBe(code === 'target_changed' ? 'result.notice.target_changed' : describeError(code).message);
    }
    expect(languages.map(language => translate(language, describeError('target_changed', { source: 'capture' }).message))).toEqual(['Window changed — try again', 'Fenêtre changée, réessayez']);
  });

  it('tells apart the situations Rust sends as no_selection, from its words, for a capture only', () => {
    // Rust's own sentences (src-tauri/src/capture.rs, lib.rs).
    const nothing = 'Rien à traduire dans la fenêtre active.';
    const settings = 'Fermez les réglages avant d’utiliser un raccourci.';
    const recent = 'Aucune traduction récente.';
    for (const sentence of [nothing, settings, recent]) expect(captureRs + libRs, sentence).toContain(sentence);
    expect(noticeCause('no_selection', nothing)).toBeNull();
    expect(noticeCause('no_selection', settings)).toBe('settings_open');
    expect(noticeCause('no_selection', recent)).toBe('nothing_recent');
    expect(noticeCause('no_selection', undefined)).toBeNull();
    // Only for the code Rust sends them with.
    expect(noticeCause('too_long', recent)).toBeNull();
    const text = (message: string) => languages.map(language => translate(language, describeError('no_selection', { source: 'capture', cause: noticeCause('no_selection', message) }).message));
    expect(text(nothing)).toEqual(['Select some text first', 'Sélectionnez d’abord du texte']);
    expect(text(settings)).toEqual(['Close Settings first', 'Fermez d’abord les Réglages']);
    expect(text(recent)).toEqual(['No recent translation', 'Aucune traduction récente']);
    // A request never takes a capture's words.
    expect(describeError('target_changed', { cause: 'settings_open' }).message).toBe('result.error.target_changed');
  });

  it('reads the paste code of a replace_result refusal from Rust’s words, paste_blocked otherwise', () => {
    // Every refusal replace_result can answer (src-tauri: lib.rs replace_result, capture.rs paste
    // and validate_target, clipboard_guard.rs put_text), with the code its words mean.
    const refusals: Array<[string, ErrorCode]> = [
      ['La fenêtre source a changé; remplacement refusé.', 'target_changed'],
      ['Le champ actif a changé; remplacement refusé.', 'target_changed'],
      ['La cible a changé; remplacement refusé.', 'target_changed'],
      ['La sélection a changé; remplacement refusé.', 'target_changed'],
      ['La sélection n’est plus disponible; utilisez Copier.', 'target_changed'],
      ['Relâchez les touches du raccourci, puis réessayez depuis la bulle.', 'keys_held'],
      ['Ce champ n’est pas modifiable; utilisez Copier.', 'not_editable'],
      ['Impossible de réactiver la fenêtre source; utilisez Copier.', 'paste_blocked'],
      ['Le collage a été bloqué par Windows ou par l’application; utilisez Copier.', 'paste_blocked'],
      ['Le résultat contient un caractère nul; remplacement refusé.', 'paste_blocked'],
      ['Le presse-papiers a changé; son nouveau contenu est conservé.', 'paste_blocked'],
      ['Le remplacement a été interrompu; utilisez Copier.', 'paste_blocked'],
      ['Ce résultat n’est plus actif.', 'paste_blocked'],
    ];
    const rust = libRs + captureRs + clipboardRs;
    for (const [sentence, code] of refusals) {
      expect(rust, sentence).toContain(sentence);
      expect(refusedPasteCode(sentence), sentence).toBe(code);
      expect(errorFamily(code)).toBe('paste');
    }
    for (const reason of [undefined, null, new Error('x'), 42, '']) expect(refusedPasteCode(reason)).toBe('paste_blocked');
  });

  it('finds every fragment of Rust’s words it reads still in src-tauri', () => {
    // A rewording on the native side fails here instead of silently showing the generic text.
    const rust = libRs + captureRs;
    for (const { words } of [...noticeWords, ...refusalWords]) expect(rust, words).toContain(words);
  });

  it('says it in six words at most, in English and in French', () => {
    const descriptions = [...errorCodes.map(kind => describeError(kind, { model: 'gemma-4-12b' })), ...errorCodes.map(kind => describeError(kind, { source: 'capture' })),
      ...noticeWords.map(({ code, cause }) => describeError(code, { source: 'capture', cause }))];
    for (const { code: kind, message, actionLabel } of descriptions) {
      for (const language of languages) {
        const text = translate(language, message, { model: 'gemma-4-12b' });
        expect(text.trim(), `${kind} ${language}`).not.toBe('');
        expect(wordCount(text), `${kind} ${language}: ${text}`).toBeLessThanOrEqual(6);
        if (actionLabel) expect(wordCount(translate(language, actionLabel)), `${kind} ${language}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('takes the lab’s wording where the lab has it', () => {
    const mapped: Array<[string, ErrorCode]> = [['endpoint', 'unreachable'], ['key', 'unauthorized'], ['model', 'model_not_found'], ['busy', 'busy'], ['paste', 'paste_blocked'], ['changed', 'target_changed'], ['long', 'too_long']];
    for (const [id, kind] of mapped) {
      const lab = outcome(id);
      const { family, message, params, actionLabel } = describeError(kind, { model: 'gemma-4-12b' });
      expect(family, id).toBe(lab.kind);
      for (const language of languages) {
        expect(translate(language, message, params), `${id} ${language}`).toBe(lab.short![language]);
        expect(actionLabel ? translate(language, actionLabel) : undefined, `${id} ${language}`).toBe(lab.action?.[language]);
      }
    }
    // Without the model's name, a plain « Model not found ».
    expect(translate('en', describeError('model_not_found').message)).toBe('Model not found');
    expect(describeError('model_not_found', { model: '  ' }).params).toBeUndefined();
    // The lab's notice when nothing is selected (Simulator.jsx:264).
    expect(['en', 'fr'].map(language => translate(language as 'en' | 'fr', describeError('no_selection').message))).toEqual(['Select some text first', 'Sélectionnez d’abord du texte']);
  });
});
