import moo from 'moo'

const lexer = moo.compile({
  WS: /[ \t]+/,
  comment: /#[^\r\n]*/,
  endpoint: /(?:GET|POST|PUT|HEAD|OPTIONS|PATCH|DELETE)\s+(?:[^\r\n]+)/,
  header: /(?:[a-z_][a-z0-9\-_]*): (?:[^\r\n]*)/,
  // number: /0|[1-9][0-9]*/,
  // string: /"(?:\\["\\]|[^\n"\\])*"/,
  // lparen: '(',
  // rparen: ')',
  // keyword: ['while', 'if', 'else', 'moo', 'cows'],
  NL: { match: /[\r\n]+/, lineBreaks: true },
})

export default async (inputText) => {
  lexer.reset(inputText)

  for (const tk of lexer) {
    console.log(tk)
  }
}
