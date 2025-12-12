# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Logger Tests
# Copyright (c) 2025 Tojioo

import logging


class TestLogger:
	"""Test logging functionality."""

	def test_get_logger_returns_logger(self):
		"""Test that get_logger returns a logger instance."""
		from logger import get_logger

		logger = get_logger("test_module")

		assert isinstance(logger, logging.Logger)

	def test_log_functions_work(self, capfd):
		"""Test that log helper functions work."""
		from logger import log_info, log_warning, log_debug, log_error

		# These should not raise exceptions
		log_info("Info message", module="Test")
		log_warning("Warning message", module="Test")
		log_debug("Debug message", module="Test")
		log_error("Error message", module="Test")

	def test_log_with_exception(self, capfd):
		"""Test logging with exception parameter."""
		from logger import log_error

		try:
			raise ValueError("Test error")
		except ValueError as e:
			# Should not raise
			log_error("Error occurred", module="Test", exception=e)