import { useState, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import { sanitizeInput } from '../../utils/sanitize';
import LoadingSpinner from '../common/LoadingSpinner';
import './MessageInput.css';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
// Must match convex/lib/utils.ts ALLOWED_FILE_TYPES
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
];

// Normalize route params: only pass non-empty IDs so Convex never receives ""
function normalizeId(value) {
  const s = value != null ? String(value).trim() : '';
  return s || undefined;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 2);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function MessageInput({ conversationId, groupId }) {
  const [content, setContent] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const convId = normalizeId(conversationId);
  const grpId = normalizeId(groupId);

  const sendMessage = useMutation(api.messages.sendMessage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileMessage = useMutation(api.files.saveFileMessage);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const trimmedContent = sanitizeInput(content.trim());
      const hasText = trimmedContent.length > 0;
      const hasFile = pendingFile != null;

      if (!hasText && !hasFile) return;
      if (!convId && !grpId) return;

      setError('');

      try {
        if (hasFile) {
          setIsUploading(true);
          setUploadProgress(0);

          const file = pendingFile;
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Upload failed');
          }

          const data = await response.json();
          const storageId = data?.storageId;
          if (!storageId) {
            throw new Error('Invalid upload response — please try again.');
          }

          await saveFileMessage({
            storageId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            content: hasText ? trimmedContent : undefined,
            conversationId: convId,
            groupId: grpId,
          });

          setPendingFile(null);
          setContent('');
          setUploadProgress(100);
        } else {
          await sendMessage({
            content: trimmedContent,
            conversationId: convId,
            groupId: grpId,
            type: 'text',
          });
          setContent('');
        }
        // Reset textarea height after sending so it matches page-load size (clear inline height)
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = '';
        }
        textareaRef.current?.focus();
      } catch (err) {
        setError(err.message || 'Failed to send');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [content, pendingFile, convId, grpId, sendMessage, generateUploadUrl, saveFileMessage]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('File type not supported. Allowed: images, PDF, Word, Excel, text, or ZIP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 20MB.');
      return;
    }

    setError('');
    setPendingFile(file);
  }, []);

  const removePendingFile = useCallback(() => {
    setPendingFile(null);
    fileInputRef.current?.value && (fileInputRef.current.value = '');
  }, []);

  const handleTextareaChange = (e) => {
    setContent(e.target.value);
    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  const isDisabled = !convId && !grpId;
  const canSend = (content.trim() || pendingFile) && !isUploading;

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      {error && (
        <div className="message-input__error" role="alert">
          {error}
          <button
            type="button"
            className="message-input__error-close"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {isUploading && (
        <div className="message-input__upload-progress">
          <LoadingSpinner size="small" />
          <span>Uploading file...</span>
        </div>
      )}

      {pendingFile && !isUploading && (
        <div className="message-input__draft-attachment">
          <span className="message-input__draft-attachment-icon">📎</span>
          <span className="message-input__draft-attachment-name" title={pendingFile.name}>
            {pendingFile.name}
          </span>
          <span className="message-input__draft-attachment-size">
            {formatFileSize(pendingFile.size)}
          </span>
          <button
            type="button"
            className="message-input__draft-attachment-remove"
            onClick={removePendingFile}
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}

      <div className="message-input__container">
        <button
          type="button"
          className="message-input__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled || isUploading}
          aria-label="Attach file"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={handleFileSelect}
          className="message-input__file-input"
          aria-hidden="true"
        />

        <textarea
          ref={textareaRef}
          className="message-input__textarea"
          value={content}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isDisabled
              ? 'Select a conversation'
              : pendingFile
                ? 'Add a message (optional)...'
                : 'Type a message...'
          }
          disabled={isDisabled || isUploading}
          rows={1}
          aria-label="Message input"
        />

        <button
          type="submit"
          className="message-input__send"
          disabled={isDisabled || !canSend}
          aria-label="Send message"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}

MessageInput.propTypes = {
  conversationId: PropTypes.string,
  groupId: PropTypes.string,
};
