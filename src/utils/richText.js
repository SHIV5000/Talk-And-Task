import { formatMessageText } from './helpers.js';

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE']);
const ALLOWED_INLINE_TAGS = {
  B: 'strong',
  STRONG: 'strong',
  I: 'em',
  EM: 'em',
  U: 'u',
  S: 'del',
  STRIKE: 'del',
  DEL: 'del',
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatTextNode = (value = '') => formatMessageText(value).replace(/&amp;(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, '&$1;');

const stripTrailingBreaks = (value = '') => value.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*)+$/gi, '');

const fallbackHtmlToText = (value = '') => String(value)
  .replace(/<\s*br\s*\/?>/gi, '\n')
  .replace(/<\s*\/\s*(p|div|li|blockquote)\s*>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .trim();

export const richTextToSafeHtml = (value = '') => {
  const input = String(value || '');
  if (!input) return '';

  if (typeof document === 'undefined') {
    return formatMessageText(fallbackHtmlToText(input));
  }

  const template = document.createElement('template');
  template.innerHTML = input;

  const walkNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return formatTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tagName = node.tagName.toUpperCase();
    if (tagName === 'SCRIPT' || tagName === 'STYLE') return '';
    if (tagName === 'BR') return '<br/>';

    const children = Array.from(node.childNodes).map(walkNode).join('');
    const inlineTag = ALLOWED_INLINE_TAGS[tagName];
    if (inlineTag) return `<${inlineTag}>${children}</${inlineTag}>`;
    if (BLOCK_TAGS.has(tagName)) return `${children}<br/>`;
    return children;
  };

  const html = Array.from(template.content.childNodes).map(walkNode).join('');
  return stripTrailingBreaks(html);
};

export const richTextToPlainText = (value = '') => {
  const input = String(value || '');
  if (!input) return '';

  if (typeof document === 'undefined') return fallbackHtmlToText(input);

  const template = document.createElement('template');
  template.innerHTML = richTextToSafeHtml(input).replace(/<\s*br\s*\/?>/gi, '\n');
  return (template.content.textContent || '').replace(/\u00a0/g, ' ').trim();
};

export const renderSafeRichText = (value = '') => ({ __html: richTextToSafeHtml(value) });
export const escapePlainText = escapeHtml;
