import { describe, expect, it } from 'vitest';
import labData from '../../design-lab/src/data.js?raw';
import { languages, translate } from '../i18n';
import { resolveField } from '../settings/fields';
import { errorCodes, type ErrorCode } from '../types';
import { describeError, errorCodeOf, errorFamily } from './errors';

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
      expect(message).toBe(describeError(code).message);
    }
  });

  it('says it in six words at most, in English and in French', () => {
    for (const kind of errorCodes) {
      const { message, actionLabel } = describeError(kind, { model: 'gemma-4-12b' });
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
