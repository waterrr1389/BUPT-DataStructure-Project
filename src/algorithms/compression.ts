export interface LzwCompressedData {
  alphabet: string[];
  codes: number[];
}

export interface CompressionStats {
  compressionRatio: number;
  dictionarySize: number;
  inputLength: number;
  outputLength: number;
  spaceSavings: number;
  uniqueSymbols: number;
}

export interface CompressionResult {
  data: LzwCompressedData;
  stats: CompressionStats;
}

function buildAlphabet(input: string): string[] {
  const seen = new Set<string>();
  const alphabet: string[] = [];

  for (const character of Array.from(input)) {
    if (!seen.has(character)) {
      seen.add(character);
      alphabet.push(character);
    }
  }

  return alphabet;
}

function getDictionarySize(data: LzwCompressedData): number {
  return data.alphabet.length + Math.max(data.codes.length - 1, 0);
}

function getFirstCharacter(text: string): string {
  const [character] = Array.from(text);

  if (!character) {
    throw new Error("Compressed entries must not be empty.");
  }

  return character;
}

function validateCompressedData(data: LzwCompressedData): void {
  const uniqueAlphabet = new Set<string>(data.alphabet);

  if (uniqueAlphabet.size !== data.alphabet.length) {
    throw new Error("Compressed alphabet must not contain duplicate symbols.");
  }

  if (data.codes.length > 0 && data.alphabet.length === 0) {
    throw new Error("Compressed data with codes must define an alphabet.");
  }
}

export function calculateCompressionStats(input: string, data: LzwCompressedData): CompressionStats {
  const inputLength = Array.from(input).length;
  const outputLength = data.codes.length;
  const compressionRatio = inputLength === 0 ? 0 : outputLength / inputLength;
  const spaceSavings = inputLength === 0 ? 0 : 1 - compressionRatio;

  return {
    compressionRatio,
    dictionarySize: getDictionarySize(data),
    inputLength,
    outputLength,
    spaceSavings,
    uniqueSymbols: data.alphabet.length,
  };
}

export function compressText(input: string): CompressionResult {
  const characters = Array.from(input);
  const alphabet = buildAlphabet(input);

  if (characters.length === 0) {
    const data: LzwCompressedData = {
      alphabet,
      codes: [],
    };

    return {
      data,
      stats: calculateCompressionStats(input, data),
    };
  }

  const dictionary = new Map<string, number>();
  const codes: number[] = [];

  alphabet.forEach((character, index) => {
    dictionary.set(character, index);
  });

  let nextCode = alphabet.length;
  let current = characters[0] as string;

  for (let index = 1; index < characters.length; index += 1) {
    const character = characters[index] as string;
    const candidate = current + character;

    if (dictionary.has(candidate)) {
      current = candidate;
    } else {
      codes.push(dictionary.get(current) as number);
      dictionary.set(candidate, nextCode);
      nextCode += 1;
      current = character;
    }
  }

  codes.push(dictionary.get(current) as number);

  const data: LzwCompressedData = {
    alphabet,
    codes,
  };

  return {
    data,
    stats: calculateCompressionStats(input, data),
  };
}

export function decompressText(data: LzwCompressedData): string {
  validateCompressedData(data);

  if (data.codes.length === 0) {
    return "";
  }

  const dictionary = [...data.alphabet];
  const firstCode = data.codes[0] as number;
  let previousEntry = dictionary[firstCode];

  if (previousEntry === undefined) {
    throw new Error(`Invalid initial compressed code: ${firstCode}`);
  }

  const output = [previousEntry];

  for (let index = 1; index < data.codes.length; index += 1) {
    const code = data.codes[index] as number;
    let entry = dictionary[code];

    // LZW emits the current dictionary size for the "previous + first(previous)" case.
    if (entry === undefined && code === dictionary.length) {
      entry = previousEntry + getFirstCharacter(previousEntry);
    }

    if (entry === undefined) {
      throw new Error(`Invalid compressed code: ${code}`);
    }

    output.push(entry);
    dictionary.push(previousEntry + getFirstCharacter(entry));
    previousEntry = entry;
  }

  return output.join("");
}
