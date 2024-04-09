#!/usr/bin/env -S node --no-warnings
import { globby } from 'globby'
import { readFile } from 'node:fs/promises'
import parse from './parser.js'

const files = await globby(['**/*.http'], {
  cwd: process.pwd
})

for (const file of files) {
  const content = await readFile(file, 'utf-8')

  const results = await parse(content)

  console.log(results)
}
