import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { format, setHours, setMinutes } from 'date-fns';
import PropTypes from 'prop-types';
import './EventModal.css';

/**
 * EventModal - Create or edit calendar events
 */
export default function EventModal({ event, initialDate, onClose }) {
  const createEvent = useMutation(api.calendar.createEvent);
  const updateEvent = useMutation(api.calendar.updateEvent);
  const deleteEvent = useMutation(api.calendar.deleteEvent);

  const isEditing = !!event;

  // Initialize form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: format(initialDate || new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    isPublic: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Populate form when editing
  useEffect(() => {
    if (event) {
      const startDate = new Date(event.startTime);
      const endDate = new Date(event.endTime);
      
      setFormData({
        title: event.title,
        description: event.description || '',
        date: format(startDate, 'yyyy-MM-dd'),
        startTime: format(startDate, 'HH:mm'),
        endTime: format(endDate, 'HH:mm'),
        isAllDay: event.isAllDay,
        isPublic: event.isPublic,
      });
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setIsSubmitting(true);

      // Parse date and times
      const dateParts = formData.date.split('-').map(Number);
      const baseDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

      let startTime, endTime;

      if (formData.isAllDay) {
        startTime = setHours(setMinutes(baseDate, 0), 0).getTime();
        endTime = setHours(setMinutes(baseDate, 59), 23).getTime();
      } else {
        const [startHour, startMin] = formData.startTime.split(':').map(Number);
        const [endHour, endMin] = formData.endTime.split(':').map(Number);
        
        startTime = setHours(setMinutes(baseDate, startMin), startHour).getTime();
        endTime = setHours(setMinutes(baseDate, endMin), endHour).getTime();
      }

      if (endTime <= startTime && !formData.isAllDay) {
        setError('End time must be after start time');
        setIsSubmitting(false);
        return;
      }

      if (isEditing) {
        const result = await updateEvent({
          eventId: event._id,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          startTime,
          endTime,
          isAllDay: formData.isAllDay,
          isPublic: formData.isPublic,
        });
        // Meeting update requested (other user was notified and must approve)
        if (result && typeof result === 'object' && result.requiresApproval) {
          setError(result.message);
          setIsSubmitting(false);
          return;
        }
      } else {
        await createEvent({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          startTime,
          endTime,
          isAllDay: formData.isAllDay,
          isPublic: formData.isPublic,
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
      setError(err.message || 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event?')) return;

    try {
      setIsSubmitting(true);
      await deleteEvent({ eventId: event._id });
      onClose();
    } catch (err) {
      console.error('Error deleting event:', err);
      setError(err.message || 'Failed to delete event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            {error && (
              <div className="event-modal__error">{error}</div>
            )}

            <div className="event-modal__field">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Event title"
                required
                autoFocus
              />
            </div>

            <div className="event-modal__field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add details about this event"
                rows={3}
              />
            </div>

            <div className="event-modal__field">
              <label htmlFor="date">Date *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="event-modal__checkbox">
              <input
                type="checkbox"
                id="isAllDay"
                name="isAllDay"
                checked={formData.isAllDay}
                onChange={handleChange}
              />
              <label htmlFor="isAllDay">All day event</label>
            </div>

            {!formData.isAllDay && (
              <div className="event-modal__time-row">
                <div className="event-modal__field">
                  <label htmlFor="startTime">Start Time</label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                  />
                </div>
                <div className="event-modal__field">
                  <label htmlFor="endTime">End Time</label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            <div className="event-modal__checkbox">
              <input
                type="checkbox"
                id="isPublic"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleChange}
              />
              <label htmlFor="isPublic">
                Make this event visible on my public calendar
              </label>
            </div>
          </div>

          <div className="modal__footer">
            {isEditing && (
              <button
                type="button"
                className="btn btn--secondary event-modal__delete-btn"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

EventModal.propTypes = {
  event: PropTypes.object,
  initialDate: PropTypes.instanceOf(Date),
  onClose: PropTypes.func.isRequired,
};
