/**
 * ===============================================
 * TERMINAL INTAKE - CLI COMMANDS
 * ===============================================
 * @file src/features/client/terminal-intake-commands.ts
 *
 * Optional CLI commands that work alongside the intake flow.
 * Inspired by codebyte.re terminal portfolio.
 */

export interface TerminalCommand {
  name: string;
  description: string;
  usage?: string;
}

/**
 * Signal values returned by command handlers
 */
export const COMMAND_SIGNALS = {
  CLEAR: 'CLEAR_SIGNAL',
  RESTART: 'RESTART_SIGNAL',
  BACK: 'BACK_SIGNAL',
  SKIP: 'SKIP_SIGNAL'
} as const;

export type CommandSignal = (typeof COMMAND_SIGNALS)[keyof typeof COMMAND_SIGNALS];

/**
 * Available CLI commands
 */
export const TERMINAL_COMMANDS: Record<string, TerminalCommand> = {
  help: {
    name: 'help',
    description: 'Show available commands',
    usage: '/help'
  },
  clear: {
    name: 'clear',
    description: 'Clear the terminal screen',
    usage: '/clear'
  },
  restart: {
    name: 'restart',
    description: 'Restart the intake process from the beginning',
    usage: '/restart'
  },
  back: {
    name: 'back',
    description: 'Go back to the previous question',
    usage: '/back'
  },
  skip: {
    name: 'skip',
    description: 'Skip current question (if optional)',
    usage: '/skip'
  },
  status: {
    name: 'status',
    description: 'Show current progress and answered questions',
    usage: '/status'
  }
};

/**
 * Format help text for display
 */
export function formatHelpText(): string {
  const lines = [
    '--- AVAILABLE COMMANDS ---',
    ''
  ];

  Object.values(TERMINAL_COMMANDS).forEach((cmd) => {
    lines.push(`  ${cmd.usage?.padEnd(12) || cmd.name.padEnd(12)} - ${cmd.description}`);
  });

  lines.push('');
  lines.push('--- KEYBOARD SHORTCUTS ---');
  lines.push('');
  lines.push('  1-9          - Select option by number');
  lines.push('  Enter        - Submit response');
  lines.push('  Arrow Up     - Previous input from history');
  lines.push('  Arrow Down   - Next input from history');
  lines.push('  Escape       - Toggle fullscreen mode');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format status text showing current progress
 */
export function formatStatusText(
  _currentIndex: number,
  totalQuestions: number,
  answeredFields: string[]
): string {
  const progress = Math.round((answeredFields.length / totalQuestions) * 100);

  const lines = [
    '--- INTAKE STATUS ---',
    '',
    `  Progress: ${progress}%`,
    `  Questions answered: ${answeredFields.length}/${totalQuestions}`,
    ''
  ];

  if (answeredFields.length > 0) {
    lines.push('  Completed fields:');
    answeredFields.forEach((field) => {
      lines.push(`    ✓ ${field}`);
    });
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Check if input is a CLI command
 */
export function isCommand(input: string): boolean {
  return input.startsWith('/');
}

/**
 * Parse command from input
 */
export function parseCommand(input: string): { command: string; args: string } {
  const trimmed = input.slice(1).trim(); // Remove leading /
  const [command, ...argParts] = trimmed.split(' ');
  return {
    command: command.toLowerCase(),
    args: argParts.join(' ')
  };
}

/**
 * Check if command exists
 */
export function commandExists(command: string): boolean {
  return command in TERMINAL_COMMANDS;
}
