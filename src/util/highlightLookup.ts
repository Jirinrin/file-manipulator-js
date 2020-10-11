import * as chalk from "chalk";

// Based on https://github.com/dracula/prism

// const originalColors = {
//   '--foreground': '#F8F8F2',
//   '--comment':    '#6272A4',
//   '--cyan':       '#8BE9FD',
//   '--green':      '#50FA7B',
//   '--orange':     '#FFB86C',
//   '--pink':       '#FF79C6',
//   '--purple':     '#BD93F9',
//   '--red':        '#FF5555',
//   '--yellow':     '#F1FA8C',
//   not sure        '#e2777a',
// }

const highlights: [string[], chalk.Chalk][] = [
  [['script', 'prolog', 'punctuation', 'charset'], chalk], // --foreground
  [['comment', 'variable'], chalk.gray], // --comment
  [['url', 'built-in', 'class-name', 'console', 'charset-punctuation', 'property-access'], chalk.cyan], // --cyan
  [['atrule', 'attr-name', 'attr-value', 'function', 'method'], chalk.greenBright], // --green
  [['property', 'parameter', 'group', 'symbol'], chalk.hex('#FFB86C')], // --orange
  [['entity', 'keyword', 'important', 'selector', 'tag', 'operator', 'arrow', 'alternation', 'quantifier'], chalk.magentaBright], // --pink
  [['boolean', 'constant', 'number', 'escape', 'charclass'], chalk.magenta], // --purple
  [['regex', 'regex-delimiter', 'charset-negation'], chalk.red], // --red
  [['string', 'char'], chalk.yellowBright], // --yellow

  // not sure: 'inserted', 'deleted', 'namespace'

  [['italic'], chalk.italic],
  [["bold", "important"], chalk.bold],
];

const highlightLookup: Record<string, chalk.Chalk> = {};
highlights.forEach(([classes, color]) => classes.forEach(c => highlightLookup[c] = color));

export default highlightLookup;
