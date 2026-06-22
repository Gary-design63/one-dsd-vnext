// =====================================================================
// One DSD vNext — speech-to-text (transcription) seam (Layer 10).
// STT capability lives in the Python/FastAPI reasoning service (ADR 15),
// e.g. a Whisper-class model. Null until a model+key is wired. Two intended
// uses: (1) voice input for Professional Support ("ask by speaking"); and
// (2) transcribing uploaded audio/video content into the corpus + captions.
// Captions storage already exists (audio_captions, migration 0006).
// =====================================================================
export interface Transcript {
  text: string;
  language: string;
  confidence: number; // 0..1
}

export interface TranscriptionProvider {
  available(): boolean;
  /** Transcribe audio bytes (or a storage ref) to text. */
  transcribe(audio: { url?: string; bytes?: Uint8Array }, opts?: { language?: string }): Promise<Transcript>;
}

class NullTranscriptionProvider implements TranscriptionProvider {
  available(): boolean { return false; }
  async transcribe(): Promise<Transcript> {
    throw new Error("transcription (speech-to-text) not configured");
  }
}

let cached: TranscriptionProvider | null = null;
export function getTranscriptionProvider(): TranscriptionProvider {
  if (!cached) cached = new NullTranscriptionProvider();
  return cached;
}
export function setTranscriptionProvider(p: TranscriptionProvider): void { cached = p; }
