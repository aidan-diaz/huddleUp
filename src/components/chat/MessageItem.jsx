import { useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PropTypes from 'prop-types';
import {
  PhoneIcon,
  PencilSquareIcon,
  MapPinIcon,
  TrashIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import { formatMessageTime, formatRelativeTime } from '../../utils/dateUtils';
import { sanitizeText } from '../../utils/sanitize';
import './MessageItem.css';

export default function MessageItem({ message, isOwnMessage, showAvatar }) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const deleteMessage = useMutation(api.messages.deleteMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const pinMessage = useMutation(api.messages.pinMessage);

  // Get file URL if it's a file message
  const fileUrl = useQuery(
    api.files.getFileUrl,
    message.type === 'file' && message.fileId ? { storageId: message.fileId } : 'skip'
  );

  const handleDelete = useCallback(async () => {
    if (window.confirm('Delete this message?')) {
      try {
        await deleteMessage({ messageId: message._id });
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    }
  }, [deleteMessage, message._id]);

  const handleEdit = useCallback(async () => {
    if (editContent.trim() === '') return;
    try {
      await editMessage({ messageId: message._id, content: editContent });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  }, [editMessage, message._id, editContent]);

  const handlePin = useCallback(async () => {
    try {
      await pinMessage({ messageId: message._id, pin: true });
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  }, [pinMessage, message._id]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  // Render deleted message (use same alignment as regular messages so our deletions stay on the right)
  if (message.isDeleted) {
    return (
      <div className={`message-item message-item--deleted ${isOwnMessage ? 'message-item--own' : ''}`}>
        <div
          className="message-item__main-wrap"
          style={isOwnMessage ? { display: 'flex', justifyContent: 'flex-end', width: '100%' } : undefined}
        >
          <div
            className="message-item__main"
            style={isOwnMessage ? { marginLeft: 'auto', width: 'fit-content', maxWidth: 'min(100%, 30rem)' } : undefined}
          >
            <div className="message-item__content">
              <span className="message-item__deleted-text">Message deleted</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render system message (like call records)
  if (message.type === 'system' || message.type === 'call') {
    return (
      <div className="message-item message-item--system">
        <div className="message-item__system-content">
          {message.type === 'call' && <PhoneIcon className="message-item__call-icon w-5 h-5" aria-hidden />}
          <span>{message.content}</span>
          {message.callDuration && (
            <span className="message-item__call-duration">
              {formatCallDuration(message.callDuration)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`message-item ${isOwnMessage ? 'message-item--own' : ''} ${showAvatar ? 'message-item--with-avatar' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwnMessage && showAvatar && (
        <div className="message-item__avatar">
          {message.sender?.avatarUrl ? (
            <img src={message.sender.avatarUrl} alt="" />
          ) : (
            <span>{message.sender?.name?.[0] || message.sender?.email?.[0] || '?'}</span>
          )}
        </div>
      )}

      {/* Wrapper: use inline style for alignment so it always applies when isOwnMessage */}
      <div
        className="message-item__main-wrap"
        style={isOwnMessage ? { display: 'flex', justifyContent: 'flex-end', width: '100%' } : undefined}
      >
      <div
        className="message-item__main"
        style={isOwnMessage ? { marginLeft: 'auto', width: 'fit-content', maxWidth: 'min(100%, 30rem)' } : undefined}
      >
        <div className="message-item__bubble">
          {!isOwnMessage && showAvatar && (
            <span className="message-item__sender">
              {message.sender?.name || message.sender?.email || 'Unknown'}
            </span>
          )}

          {isEditing ? (
            <div className="message-item__edit">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="message-item__edit-actions">
                <button
                  className="btn btn--secondary btn--small"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content);
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn--primary btn--small" onClick={handleEdit}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.type === 'file' ? (
                <div className="message-item__file-wrapper">
                  <FileAttachment
                    fileName={message.fileName}
                    fileType={message.fileType}
                    fileSize={message.fileSize}
                    fileUrl={fileUrl}
                  />
                  {message.content && message.content !== message.fileName && (
                    <p className="message-item__file-caption">{sanitizeText(message.content)}</p>
                  )}
                </div>
              ) : (
                <p className="message-item__text">
                  {sanitizeText(message.content)}
                  {message.updatedAt && (
                    <span className="message-item__edited">(edited)</span>
                  )}
                </p>
              )}
            </>
          )}

          <span className="message-item__time" title={formatRelativeTime(message.createdAt)}>
            {formatMessageTime(message.createdAt)}
          </span>
        </div>

        {showActions && !isEditing && isOwnMessage && (
          <div className="message-item__actions">
            {message.type === 'text' && (
              <button
                className="message-item__action"
                onClick={() => setIsEditing(true)}
                title="Edit"
              >
                <PencilSquareIcon className="w-5 h-5" aria-hidden />
              </button>
            )}
            <button className="message-item__action" onClick={handlePin} title="Pin">
              <MapPinIcon className="w-5 h-5" aria-hidden />
            </button>
            <button className="message-item__action" onClick={handleDelete} title="Delete">
              <TrashIcon className="w-5 h-5" aria-hidden />
            </button>
          </div>
        )}

        {showActions && !isEditing && !isOwnMessage && (
          <div className="message-item__actions">
            <button className="message-item__action" onClick={handlePin} title="Pin">
              <MapPinIcon className="w-5 h-5" aria-hidden />
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// File attachment component
function FileAttachment({ fileName, fileType, fileSize, fileUrl }) {
  const isImage = fileType?.startsWith('image/');
  const formattedSize = formatFileSize(fileSize);

  if (isImage && fileUrl) {
    return (
      <div className="message-item__file message-item__file--image">
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img src={fileUrl} alt={fileName} loading="lazy" />
        </a>
      </div>
    );
  }

  return (
    <div className="message-item__file">
      <PaperClipIcon className="message-item__file-icon w-6 h-6 flex-shrink-0" aria-hidden />
      <div className="message-item__file-info">
        <span className="message-item__file-name">{fileName}</span>
        <span className="message-item__file-size">{formattedSize}</span>
      </div>
      {fileUrl && (
        <a
          href={fileUrl}
          download={fileName}
          className="message-item__file-download"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download
        </a>
      )}
    </div>
  );
}

function formatCallDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

MessageItem.propTypes = {
  message: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    senderId: PropTypes.string.isRequired,
    sender: PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      email: PropTypes.string,
      avatarUrl: PropTypes.string,
    }),
    type: PropTypes.oneOf(['text', 'file', 'system', 'call']).isRequired,
    fileId: PropTypes.string,
    fileName: PropTypes.string,
    fileType: PropTypes.string,
    fileSize: PropTypes.number,
    callDuration: PropTypes.number,
    isDeleted: PropTypes.bool.isRequired,
    createdAt: PropTypes.number.isRequired,
    updatedAt: PropTypes.number,
  }).isRequired,
  isOwnMessage: PropTypes.bool.isRequired,
  showAvatar: PropTypes.bool,
};

FileAttachment.propTypes = {
  fileName: PropTypes.string,
  fileType: PropTypes.string,
  fileSize: PropTypes.number,
  fileUrl: PropTypes.string,
};
