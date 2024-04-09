#!/usr/bin/env -S node --no-warnings

import { globby } from 'globby'

const files = await globby(['**/*.http'], {
  cwd: process.pwd
})

for (const file of files) {

  const file = readFile()

}
