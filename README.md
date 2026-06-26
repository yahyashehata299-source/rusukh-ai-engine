# Rusukh vertical slice

This branch contains a minimal vertical-slice implementation for the Rusukh flashcard pipeline.

Usage:

- npm install
- npm run start -- --pdf path/to/book.pdf --out out/cards.jsonl

This will extract text, run simple cleaning and concept extraction optimized for Arabic Islamic texts, generate preliminary flashcards, and write JSONL + CSV exports.
