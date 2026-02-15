/**
 * ===============================================
 * RICH TEXT EDITOR COMPONENT
 * ===============================================
 * @file src/components/rich-text-editor.ts
 *
 * Wrapper around Quill.js for contract and proposal editing.
 * Provides a clean API for rich text editing with variable support.
 */

import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export interface RichTextEditorOptions {
  container: HTMLElement;
  placeholder?: string;
  initialContent?: string;
  onChange?: (content: string) => void;
  height?: string;
  toolbarOptions?: 'minimal' | 'standard' | 'full';
}

export interface RichTextEditorInstance {
  getHTML: () => string;
  getText: () => string;
  setHTML: (html: string) => void;
  setText: (text: string) => void;
  insertText: (text: string) => void;
  insertVariable: (variable: string) => void;
  focus: () => void;
  destroy: () => void;
  quill: Quill;
}

// Toolbar configurations
const TOOLBAR_CONFIGS = {
  minimal: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean']
  ],
  standard: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['link'],
    ['clean']
  ],
  full: [
    [{ header: [1, 2, 3, 4, false] }],
    [{ font: [] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['link', 'image'],
    ['blockquote', 'code-block'],
    ['clean']
  ]
};

/**
 * Creates a rich text editor instance
 */
export function createRichTextEditor(options: RichTextEditorOptions): RichTextEditorInstance {
  const {
    container,
    placeholder = 'Enter text...',
    initialContent = '',
    onChange,
    height = '200px',
    toolbarOptions = 'standard'
  } = options;

  // Create editor wrapper structure
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-text-editor';

  const toolbarContainer = document.createElement('div');
  toolbarContainer.className = 'rich-text-toolbar';

  const editorContainer = document.createElement('div');
  editorContainer.className = 'rich-text-content';
  editorContainer.style.height = height;

  wrapper.appendChild(toolbarContainer);
  wrapper.appendChild(editorContainer);
  container.appendChild(wrapper);

  // Initialize Quill
  const quill = new Quill(editorContainer, {
    theme: 'snow',
    placeholder,
    modules: {
      toolbar: {
        container: toolbarContainer,
        handlers: {}
      }
    }
  });

  // Build toolbar manually for better control
  const toolbarConfig = TOOLBAR_CONFIGS[toolbarOptions];
  const toolbar = quill.getModule('toolbar') as unknown as { container: HTMLElement };
  if (toolbar && toolbar.container) {
    toolbar.container.innerHTML = buildToolbarHTML(toolbarConfig);
    attachToolbarHandlers(toolbar.container, quill);
  }

  // Set initial content
  if (initialContent) {
    if (initialContent.startsWith('<') && initialContent.includes('</')) {
      quill.clipboard.dangerouslyPasteHTML(initialContent);
    } else {
      quill.setText(initialContent);
    }
  }

  // Setup change handler
  if (onChange) {
    quill.on('text-change', () => {
      onChange(quill.root.innerHTML);
    });
  }

  return {
    getHTML: () => quill.root.innerHTML,
    getText: () => quill.getText(),
    setHTML: (html: string) => {
      quill.clipboard.dangerouslyPasteHTML(html);
    },
    setText: (text: string) => {
      quill.setText(text);
    },
    insertText: (text: string) => {
      const range = quill.getSelection(true);
      quill.insertText(range.index, text);
    },
    insertVariable: (variable: string) => {
      const range = quill.getSelection(true);
      quill.insertText(range.index, `{{${variable}}}`);
    },
    focus: () => {
      quill.focus();
    },
    destroy: () => {
      wrapper.remove();
    },
    quill
  };
}

/**
 * Builds toolbar HTML from config
 */
function buildToolbarHTML(config: (string | Record<string, unknown>)[][]): string {
  return config.map(group => {
    const buttons = group.map(item => {
      if (typeof item === 'string') {
        return `<button class="ql-${item}" type="button" aria-label="${item}"></button>`;
      }
      const [key, value] = Object.entries(item)[0];
      if (Array.isArray(value)) {
        const options = value.map(v => `<option value="${v === false ? '' : v}">${v === false ? 'Normal' : v}</option>`).join('');
        return `<select class="ql-${key}" aria-label="${key}">${options}</select>`;
      }
      return `<button class="ql-${key}" value="${value}" type="button" aria-label="${key} ${value}"></button>`;
    }).join('');
    return `<span class="ql-formats">${buttons}</span>`;
  }).join('');
}

/**
 * Attaches handlers to toolbar buttons
 */
function attachToolbarHandlers(container: HTMLElement, quill: Quill): void {
  // Clean button
  const cleanBtn = container.querySelector('.ql-clean');
  if (cleanBtn) {
    cleanBtn.addEventListener('click', () => {
      const range = quill.getSelection();
      if (range) {
        quill.removeFormat(range.index, range.length);
      }
    });
  }

  // Format buttons
  container.querySelectorAll('button[class^="ql-"]').forEach(btn => {
    const format = btn.className.replace('ql-', '').split(' ')[0];
    if (format === 'clean') return;

    btn.addEventListener('click', () => {
      const range = quill.getSelection();
      if (!range) return;

      const value = (btn as HTMLButtonElement).value;
      if (value) {
        quill.format(format, value);
      } else {
        const currentFormat = quill.getFormat(range);
        quill.format(format, !currentFormat[format]);
      }
    });
  });

  // Select dropdowns
  container.querySelectorAll('select[class^="ql-"]').forEach(select => {
    const format = select.className.replace('ql-', '').split(' ')[0];
    select.addEventListener('change', () => {
      const value = (select as HTMLSelectElement).value;
      quill.format(format, value || false);
    });
  });
}

/**
 * Converts HTML content to plain text preserving structure
 * for PDF generation compatibility
 */
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  let result = '';

  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Handle block elements with line breaks
    const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'blockquote'].includes(tag);

    if (tag === 'br') {
      result += '\n';
      return;
    }

    // Headers become section-style text
    if (tag.startsWith('h')) {
      const level = parseInt(tag[1]);
      if (level <= 2) {
        // H1/H2 become numbered sections
        const text = el.textContent?.trim() || '';
        result += `\n${text.toUpperCase()}\n`;
        return;
      }
    }

    // List items with bullets
    if (tag === 'li') {
      const parent = el.parentElement;
      if (parent?.tagName.toLowerCase() === 'ol') {
        const index = Array.from(parent.children).indexOf(el) + 1;
        result += `${index}. `;
      } else {
        result += '- ';
      }
    }

    // Process children
    el.childNodes.forEach(child => processNode(child));

    // Add line breaks after block elements
    if (isBlock && !['br', 'li'].includes(tag)) {
      result += '\n';
    }
    if (tag === 'li') {
      result += '\n';
    }
  };

  processNode(div);

  // Clean up extra whitespace
  return result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
    .trim();
}

/**
 * Converts plain text to basic HTML
 */
export function plainTextToHTML(text: string): string {
  const lines = text.split('\n');
  let inList = false;
  let html = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += '<p><br></p>';
      continue;
    }

    // Numbered section (e.g., "1. Section Title")
    if (/^\d+\.\s+/.test(trimmed)) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      const content = trimmed.replace(/^\d+\.\s+/, '');
      html += `<h3>${escapeHtml(content)}</h3>`;
      continue;
    }

    // ALL CAPS title
    if (/^[A-Z][A-Z\s]{3,}$/.test(trimmed)) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h2>${escapeHtml(trimmed)}</h2>`;
      continue;
    }

    // Bullet point
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      const content = trimmed.replace(/^[-*]\s+/, '');
      html += `<li>${escapeHtml(content)}</li>`;
      continue;
    }

    // Regular paragraph
    if (inList) {
      html += '</ul>';
      inList = false;
    }
    html += `<p>${escapeHtml(trimmed)}</p>`;
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
