import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import { sanitizeInput } from '../../utils/sanitize';
import LoadingSpinner from '../common/LoadingSpinner';
import './MessageInput.css';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export default function MessageInput({ conversationId, groupId }) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const sendMessage = useMutation(api.messages.sendMessage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileMessage = useMutation(api.files.saveFileMessage);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const trimmedContent = sanitizeInput(content.trim());

      if (!trimmedContent) return;
      if (!conversationId && !groupId) return;

      try {
        setError('');
        await sendMessage({
          content: trimmedContent,
          conversationId,
          groupId,
          type: 'text',
        });
        setContent('');
        textareaRef.current?.focus();
      } catch (err) {
        setError(err.message || 'Failed to send message');
      }
    },
    [content, conversationId, groupId, sendMessage]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input
      e.target.value = '';

      // Validate file
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError('File type not supported. Please upload images, PDFs, or documents.');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError('File is too large. Maximum size is 20MB.');
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);
      setError('');

      try {
        // Get upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const { storageId } = await response.json();

        // Save file message
        await saveFileMessage({
          storageId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          conversationId,
          groupId,
        });

        setUploadProgress(100);
      } catch (err) {
        setError(err.message || 'Failed to upload file');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [conversationId, groupId, generateUploadUrl, saveFileMessage]
  );

  const handleTextareaChange = (e) => {
    setContent(e.target.value);
    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  const isDisabled = !conversationId && !groupId;

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
          placeholder={isDisabled ? 'Select a conversation' : 'Type a message...'}
          disabled={isDisabled || isUploading}
          rows={1}
          aria-label="Message input"
        />

        <button
          type="submit"
          className="message-input__send"
          disabled={isDisabled || !content.trim() || isUploading}
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
