#!/usr/bin/env -S node --no-warnings
import { globby } from 'globby'
import nearley from "nearley"
import { readFile } from 'node:fs/promises'
import grammar from "./grammar.js"

const files = await globby(['**/*.http'], {
  cwd: process.pwd
})

for (const file of files) {
  const content = await readFile(file, 'utf-8')

  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

  parser.feed(content)

  console.log(parser)
}
