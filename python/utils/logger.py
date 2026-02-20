# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Logging Module
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

"""
Logging helper module for Tojioo Passthrough Nodes.
Integrates with ComfyUI's logging system for consistent log output.
"""

import logging
import sys
from typing import Optional


# Module name for logger identification
_MODULE_NAME = "TojiooPassthrough"

# Try to use ComfyUI's logging if available, fall back to standard logging
try:
	from comfy.utils import set_progress_bar_global_hook


	_COMFYUI_AVAILABLE = True
except ImportError:
	_COMFYUI_AVAILABLE = False


class _SafeStreamHandler(logging.StreamHandler):
	"""
	A StreamHandler that survives pytest/IDE output capture swapping/closing stdout.

	JetBrains' pytest runner can close or replace sys.stdout during capture,
	which can break handlers that hold onto the old stream.
	"""


	def emit(self, record):
		try:
			if self.stream is None or getattr(self.stream, "closed", False):
				# Prefer the original streams if available
				self.setStream(getattr(sys, "__stdout__", sys.stdout))
			super().emit(record)
		except ValueError:
			# Last-resort: try stderr
			try:
				self.setStream(getattr(sys, "__stderr__", sys.stderr))
				super().emit(record)
			except Exception:
				# Never let logging crash the program/tests
				pass


def _get_logger(name: str) -> logging.Logger:
	"""
	Get or create a logger for the specified module name.
	"""
	logger = logging.getLogger(f"{_MODULE_NAME}.{name}")

	# Only configure if this is the first time
	if not logger.handlers:
		logger.setLevel(logging.DEBUG)

		# Use a safe stream handler (see above)
		stream = getattr(sys, "__stdout__", sys.stdout)
		handler = _SafeStreamHandler(stream)
		handler.setLevel(logging.DEBUG)

		formatter = logging.Formatter(fmt = "[%(name)s] %(levelname)s: %(message)s")
		handler.setFormatter(formatter)

		logger.addHandler(handler)

		# Avoid double logging if root logger is configured elsewhere
		logger.propagate = False

	return logger


def get_logger(module_name: str) -> logging.Logger:
	"""
	Get a logger for the specified module.
	"""
	base_name = module_name.rsplit(".", 1)[-1]
	return _get_logger(base_name)


def log_info(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Log an info message.

	Args:
		message: The log message
		module: The module name (default: "Core")
		exception: Optional exception to log with traceback
	"""
	logger = get_logger(module)
	if exception is not None:
		logger.info(message, exc_info = exception)
	else:
		logger.info(message)


def log_warning(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Log a warning message.

	Args:
		message: The log message
		module: The module name (default: "Core")
		exception: Optional exception to log with traceback
	"""
	logger = get_logger(module)
	if exception is not None:
		logger.warning(message, exc_info = exception)
	else:
		logger.warning(message)


def log_debug(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Log a debug message.

	Args:
		message: The log message
		module: The module name (default: "Core")
		exception: Optional exception to log with traceback
	"""
	logger = get_logger(module)
	if exception is not None:
		logger.debug(message, exc_info = exception)
	else:
		logger.debug(message)


def log_error(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Log an error message.

	Args:
		message: The log message
		module: The module name (default: "Core")
		exception: Optional exception to log with traceback
	"""
	logger = get_logger(module)
	if exception is not None:
		logger.error(message, exc_info = exception)
	else:
		logger.error(message)


__all__ = ["get_logger", "log_info", "log_warning", "log_debug", "log_error"]