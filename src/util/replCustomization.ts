import * as chalk from "chalk";
import { Completer, CompleterResult, cursorTo } from "readline";
import * as refractor from "refractor";
import { REPLServer } from "repl";

import { r } from "..";
import { cmdInfo } from "../modules";
import { escapeRegex, splitArgsString } from "./generalUtils";
import highlightLookup from "./highlightLookup";
import { jsGlobalObjects, jsKeywords } from "./input/javascriptComplWords";
import { config, userScripts } from "./LocalStorage";
import { customTabComplete } from "./replCustomizationOverwrite";

const getCommand = (line: string) =>
  (line.match(/^\.([\w-]+)( +)?/) ?? []) as [cmdMatch?: string, cmdName?: string, space?: string];


// Auto completion

export type CustomCompleterResult = [completions: string[], matchString: string, actualCompletions?: string[], actualMatchString?: string];

let emptyCompl: CompleterResult;

let jsGlobalKeys: string[];
let jsGlobalKeyValues: Record<string, string[]>;
const setJsGlobalKeys = () => {
  jsGlobalKeys = [
    ...jsGlobalObjects.map(([key]) => key),
    ...jsKeywords,
  ];
  jsGlobalKeyValues = jsGlobalObjects.reduce((acc, [key, obj]) => ({
    ...acc,
    [key]: key.match(/^[A-Z]/) ? Object.getOwnPropertyNames(obj) : Object.keys(obj),
  }), {});
};

function completeJs(line: string): CustomCompleterResult {
  if (!jsGlobalKeys) setJsGlobalKeys();

  const checkString = line.slice(line.lastIndexOf(' ')+1);
  const [objKeyMatch, objKey, objSubKey] = (checkString.match(/(\w+)\.(\w*)/) ?? []);
  if (!objKeyMatch)
    // Defined variables will only show up in global when you initialized them with `var`
    return completeCaseIns(checkString, [...Object.keys(global), ...jsGlobalKeys]);
  
  if (jsGlobalKeyValues[objKey])
    return completeCaseIns(objSubKey, jsGlobalKeyValues[objKey])

  return emptyCompl;
   // todo: even better autocompletion interwoven through javascript? (parse with acorn) or at least some common keywords
}

function completeCaseIns(stringToCheck: string, completions: string[]|Record<string,any>): CustomCompleterResult {
  const completionsArray = Array.isArray(completions) ? completions : Object.keys(completions);
  const checkRegex = new RegExp(`^${escapeRegex(stringToCheck)}`, 'i');
  const actualCompletions = completionsArray.filter(c => c.match(checkRegex));
  // global.log('completion case ins', stringToCheck, completionsArray, actualCompletions);
  if (!actualCompletions.length)
    return emptyCompl;
  const trimmedCompletions = actualCompletions.map(c => c.slice(stringToCheck.length)).filter(c => !!c);
  return [ trimmedCompletions, '', actualCompletions, stringToCheck ];
}

function getCompletionData(line: string): CustomCompleterResult {
  emptyCompl = [ [], line ] as CompleterResult;
  if (!line.startsWith('.'))
    return completeJs(line);   

  const [cmdMatch, cmdName, space] = getCommand(line);
  if (!space || !r.commands[cmdName]) {
    if (!cmdName)
      return emptyCompl;

    return completeCaseIns(cmdName, r.commands);
  }

  const {renderOpts, optsValues} = cmdInfo[cmdName];
  // Assuming you put only one character between opt and value
  const typingOption = line.match(/--(\w*)([= ]\w*)?$/);
  if (typingOption && renderOpts) {
    const [typOptMatch, typOptName, typOptFromEquals] = typingOption;
    // global.log('slice', typingOption.index, typOptName, typOptName.length, line, line.slice(typingOption.index+typOptName.length+1))
    if (typOptFromEquals)
      return completeCaseIns(line.slice(typingOption.index+typOptName.length+2+1), optsValues[typOptName] ?? []);
    return completeCaseIns(line.slice(typingOption.index), [...renderOpts, '--help']);
  }

  if (cmdName.match(/^userscript(?:-(get|set|delete))?/))
    return completeCaseIns(line.slice(cmdMatch.length), userScripts.s);
    if (cmdName.match(/^config-[gs]et/))
    return completeCaseIns(line.slice(cmdMatch.length), config.s);
    if (cmdName === 'helpp')
    return completeCaseIns(line.slice(cmdMatch.length), r.commands);

  return emptyCompl;
}

export const completer: Completer = (line: string) => {
  const [completions, matchString, actualCompletions, actualMatchString] = getCompletionData(line);
  const hits = completions.filter((c) => c.startsWith(matchString));
  return [hits, matchString, actualCompletions, actualMatchString] as unknown as [string[], string];
}


// Syntax highlighting

function parseHighlightNode(node: refractor.RefractorNode, classNames: string[] = [], defaultChalk: chalk.Chalk = chalk): string {
  if (node.type === 'element')
    return node.children.map(c => parseHighlightNode(c, node.properties.className)).join('');

  let val = node.value;
  classNames.forEach(className => {
    if (className === 'token' || className.startsWith('language-')) // todo?: maybe some system with language specific class overwrites?
      return;
    const ch = highlightLookup[className];
    if (ch) val = ch(val);
    else console.plog(`unknown highlight class: ${className}. Val: ${val}`);
  });
  return val;
};

export function highlight(part: string, lang: string): string {
  return refractor.highlight(part, lang)
    .map(c => parseHighlightNode(c))
    .join('');
}

class ResultBuilder {
  public result: string = '';
  constructor(public l: string) {}
  public eatFromInput(howMuchToEat: number, addToResult: string) {
    this.result += addToResult;
    this.l = this.l.slice(howMuchToEat);
  }
}

export function highlightLine(line: string): string {
  const b = new ResultBuilder(line);

  const [cmdMatch, cmdName] = getCommand(b.l);
  if (b.l.startsWith('.')) {
    if (!cmdMatch) return line;
    b.eatFromInput(cmdMatch.length, b.l.slice(0, cmdMatch.length))
  }

  const [optsReverse, part1, part2] = splitArgsString(b.l);
  const drawBody = (part: string): string => {
    const p = new ResultBuilder(part);
    if (cmdName === 'renameEach-rx') {
      const [arg1Match, quote1, actualRegex, quote2] = p.l.match(/^(")([^"]+)("?)/) ?? p.l.match(/^(')([^']+)('?)/) ?? p.l.match(/^(\/)([^\/]+)(\/?)/) ?? p.l.match(/^(`)([^`]+)(`?)/) ?? p.l.match(/^()(\S+)()/) ?? [];
      if (arg1Match) {
        if (quote1) p.eatFromInput(1, chalk.red(quote1));
        p.eatFromInput(actualRegex.length, highlight(p.l.slice(0, actualRegex.length), 'regex'));
        if (quote2) p.eatFromInput(1, chalk.red(quote2));
      }
    }
    return p.result + highlight(p.l, 'js');
  };

  const drawOptions = (part: string): string => {
    return highlight(part, 'bash');
  };

  const drawPart = (part: string, drawer: (part: string) => string) => {
    const output = drawer(part);
    b.eatFromInput(part.length, output);
  } 

  if (optsReverse) {
    drawPart(part1, drawOptions);
    drawPart(part2, drawBody);
  } else {
    drawPart(part1, drawBody);
    drawPart(part2, drawOptions);
  }

  return b.result;
}

// Bare bones variation on Interface._refreshLine, to facilitate syntax highlighting
function /*REPLServer.*/refreshCurrentLine(input: string) {
  const line = this._prompt + input;
  const cursorPos = this.getCursorPos();
  cursorTo(this.output, 0);
  this._writeToOutput(line);
  cursorTo(this.output, cursorPos.cols);
}

export function setupReplCustomization(r: REPLServer) {
  const rr = r as any;

  process.stdin.on('keypress', (c, k) => {
    if (!config.s.syntaxHighlighting) return;

    if (c !== "\"\\u0003\"" && c !== "\"\\r\"") {
      // todo: remove timeout?
      setTimeout(() => {
        const edited = highlightLine(rr.line);
        // global.log('yo', rr.line, '|||', edited);
        rr._refreshCurrentLine(edited);
      }, 0);
    }
  });

  rr._refreshCurrentLine = refreshCurrentLine;

  rr._tabComplete = customTabComplete;
}
