export type FrameQueue = {
	flush: () => void;
};

export function installFrameQueue(): FrameQueue
{
	let queue: FrameRequestCallback[] = [];

	// Needed so callbacks run after the scheduling call returns and get a non-zero handle, as real requestAnimationFrame does.
	(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => queue.push(cb);

	return {
		flush: () =>
		{
			const frame = queue;
			queue = [];
			for (const cb of frame)
			{
				cb(0);
			}
		},
	};
}
