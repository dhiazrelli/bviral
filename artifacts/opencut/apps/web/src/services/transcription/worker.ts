import type { TranscriptionSegment } from "@/transcription/types";

export type WorkerMessage =
	| { type: "init"; modelId: string }
	| { type: "transcribe"; audio: Float32Array; language: string }
	| { type: "cancel" };

export type WorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| { type: "transcribe-progress"; progress: number }
	| {
			type: "transcribe-complete";
			text: string;
			segments: TranscriptionSegment[];
	  }
	| { type: "transcribe-error"; error: string }
	| { type: "cancelled" };

let cancelled = false;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	switch (message.type) {
		case "init":
			void message.modelId;
			self.postMessage({
				type: "init-error",
				error: "Automatic transcription is not enabled in this BVIRAL build.",
			} satisfies WorkerResponse);
			break;
		case "transcribe":
			void message.audio;
			void message.language;
			cancelled = false;
			if (cancelled) return;
			self.postMessage({
				type: "transcribe-error",
				error: "Automatic transcription is not enabled in this BVIRAL build.",
			} satisfies WorkerResponse);
			break;
		case "cancel":
			cancelled = true;
			self.postMessage({ type: "cancelled" } satisfies WorkerResponse);
			break;
	}
};
