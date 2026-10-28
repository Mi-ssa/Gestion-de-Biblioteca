const readline = require('node:readline');
const { emitKeypressEvents } = require('node:readline');

function promptLine(prompt) {
  const interfaceInstance = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => interfaceInstance.question(prompt, (answer) => {
    interfaceInstance.close();
    resolve(answer.trim());
  }));
}

function promptHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('La contraseña debe introducirse desde una terminal interactiva.'));
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);

  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    }
    function onKeypress(character, key = {}) {
      if (key.ctrl && key.name === 'c') return finish(new Error('Operación cancelada.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') {
        value = value.slice(0, -1);
        return;
      }
      if (character && !key.ctrl && !key.meta) value += character;
    }
    process.stdin.on('keypress', onKeypress);
  });
}

module.exports = { promptHidden, promptLine };
