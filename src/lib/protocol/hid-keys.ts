/** USB HID keyboard usages (page 0x07) keyed by KeyboardEvent.code, with display labels. */

const KEYS: [code: string, usage: number, label: string][] = [];

for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(65 + i);
  KEYS.push([`Key${ch}`, 0x04 + i, ch]);
}
for (let i = 1; i <= 9; i++) KEYS.push([`Digit${i}`, 0x1d + i, String(i)]);
KEYS.push(['Digit0', 0x27, '0']);
for (let i = 1; i <= 12; i++) KEYS.push([`F${i}`, 0x39 + i, `F${i}`]);
for (let i = 13; i <= 24; i++) KEYS.push([`F${i}`, 0x68 + i - 13, `F${i}`]);
for (let i = 1; i <= 9; i++) KEYS.push([`Numpad${i}`, 0x58 + i, `Num ${i}`]);

KEYS.push(
  ['Enter', 0x28, 'Enter'],
  ['Escape', 0x29, 'Esc'],
  ['Backspace', 0x2a, 'Backspace'],
  ['Tab', 0x2b, 'Tab'],
  ['Space', 0x2c, 'Space'],
  ['Minus', 0x2d, '-'],
  ['Equal', 0x2e, '='],
  ['BracketLeft', 0x2f, '['],
  ['BracketRight', 0x30, ']'],
  ['Backslash', 0x31, '\\'],
  ['Semicolon', 0x33, ';'],
  ['Quote', 0x34, "'"],
  ['Backquote', 0x35, '`'],
  ['Comma', 0x36, ','],
  ['Period', 0x37, '.'],
  ['Slash', 0x38, '/'],
  ['CapsLock', 0x39, 'Caps Lock'],
  ['PrintScreen', 0x46, 'Print Screen'],
  ['ScrollLock', 0x47, 'Scroll Lock'],
  ['Pause', 0x48, 'Pause'],
  ['Insert', 0x49, 'Insert'],
  ['Home', 0x4a, 'Home'],
  ['PageUp', 0x4b, 'Page Up'],
  ['Delete', 0x4c, 'Delete'],
  ['End', 0x4d, 'End'],
  ['PageDown', 0x4e, 'Page Down'],
  ['ArrowRight', 0x4f, '→'],
  ['ArrowLeft', 0x50, '←'],
  ['ArrowDown', 0x51, '↓'],
  ['ArrowUp', 0x52, '↑'],
  ['NumLock', 0x53, 'Num Lock'],
  ['NumpadDivide', 0x54, 'Num /'],
  ['NumpadMultiply', 0x55, 'Num *'],
  ['NumpadSubtract', 0x56, 'Num -'],
  ['NumpadAdd', 0x57, 'Num +'],
  ['NumpadEnter', 0x58, 'Num Enter'],
  ['Numpad0', 0x62, 'Num 0'],
  ['NumpadDecimal', 0x63, 'Num .'],
  ['IntlBackslash', 0x64, '\\'],
  ['ContextMenu', 0x65, 'Menu'],
  ['ControlLeft', 0xe0, 'Ctrl'],
  ['ShiftLeft', 0xe1, 'Shift'],
  ['AltLeft', 0xe2, 'Alt'],
  ['MetaLeft', 0xe3, 'Win'],
  ['ControlRight', 0xe4, 'Right Ctrl'],
  ['ShiftRight', 0xe5, 'Right Shift'],
  ['AltRight', 0xe6, 'Right Alt'],
  ['MetaRight', 0xe7, 'Right Win'],
);

const BY_CODE = new Map(KEYS.map(([code, usage]) => [code, usage]));
const LABELS = new Map(KEYS.map(([, usage, label]) => [usage, label]));

export const usageForCode = (code: string): number | undefined => BY_CODE.get(code);
export const keyLabel = (usage: number): string => LABELS.get(usage) ?? `Key 0x${usage.toString(16).toUpperCase()}`;

export const MOUSE_BUTTON_LABELS: Record<number, string> = {
  1: 'Left click',
  2: 'Right click',
  4: 'Middle click',
  8: 'Back',
  16: 'Forward',
};
/** KeyboardEvent/MouseEvent.button → mouse mask used in macros. */
export const MOUSE_MASK_FOR_BUTTON = [1, 4, 2, 8, 16];
