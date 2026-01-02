# extension entry point for new ComfyUI API
# Currently unused

# from typing import TYPE_CHECKING, override
#
# if TYPE_CHECKING:
# 	from comfy_api.latest import ComfyExtension, io
#
# class TojiooPassthroughExtension(ComfyExtension):
# 	@override
# 	async def get_node_list(self) -> list[type[io.ComfyNode]]:
# 		return [...]
#
# async def comfy_entrypoint() -> TojiooPassthroughExtension:
# 	return TojiooPassthroughExtension()