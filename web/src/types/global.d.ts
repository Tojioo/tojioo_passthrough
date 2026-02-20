export {};

declare global
{
	const LiteGraph: any;
	type ISlotType = string | number;

	type LGraph = any;
	type LLink = any;
	type LGraphNode = any; /* Maybe I'll remove it later. I'll do it. I swear. Pinky promise.*/

	declare const __VERSION__: string;
}