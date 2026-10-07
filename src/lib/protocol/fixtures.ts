/** Settings block (flash 0x0000–0x00BF) read from a real M600 V2, used by tests and the simulated mouse. */
export const M600_SETTINGS = Uint8Array.from(
  (
    '01 54 06 4F 02 53 00 55 00 55 01 54 07 07 00 47 1F 1F 00 17 0F 0F 00 37 3F 3F 00 D7 7F 7F 00 57 ' +
    '07 07 88 BF 07 07 88 BF 07 07 88 BF FF 80 00 D6 00 FF 00 56 FF 00 00 56 00 00 FF 56 00 FF FF 57 ' +
    'FF 00 FF 57 FF 00 FF 57 FF 00 FF 57 02 53 80 D5 03 52 00 55 FF 00 FF 57 00 55 80 D5 03 52 00 55 ' +
    '01 01 00 53 01 02 00 52 01 04 00 50 01 08 00 4C 01 10 00 44 02 01 00 52 00 00 00 55 00 00 00 55 ' +
    '07 00 00 4E 02 02 00 51 02 03 00 50 00 00 00 55 00 00 00 55 00 00 00 55 00 00 00 55 00 00 00 55 ' +
    '01 FF 00 FF 07 09 46 00 55 08 4D 01 54 06 4F 00 55 00 55 00 55 00 55 06 4F 00 55 0A 4B FF FF FF'
  )
    .split(' ')
    .map((h) => parseInt(h, 16)),
);
