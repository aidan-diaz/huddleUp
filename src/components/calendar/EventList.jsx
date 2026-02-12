import { useMutation } from 'convex/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '../../../convex/_generated/api';
import { format } from 'date-fns';
import PropTypes from 'prop-types';
import './EventList.css';

/**
 * EventList - Displays a list of calendar events
 */
export default function EventList({ events, onEdit, emptyMessage }) {
  const deleteEvent = useMutation(api.calendar.deleteEvent);

  const handleDelete = async (event, e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${event.title}"?`)) return;
    
    try {
      await deleteEvent({ eventId: event._id });
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="event-list event-list--empty">
        <p>{emptyMessage || 'No events'}</p>
      </div>
    );
  }

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="event-list">
      {sortedEvents.map((event) => (
        <div
          key={event._id}
          className="event-list__item"
          onClick={() => onEdit?.(event)}
        >
          <div className="event-list__time">
            {event.isAllDay ? (
              <span className="event-list__all-day">All day</span>
            ) : (
              <>
                <span>{format(new Date(event.startTime), 'h:mm a')}</span>
                <span className="event-list__time-separator">-</span>
                <span>{format(new Date(event.endTime), 'h:mm a')}</span>
              </>
            )}
          </div>
          <div className="event-list__content">
            <h4 className="event-list__title">{event.title}</h4>
            {event.description && (
              <p className="event-list__description">{event.description}</p>
            )}
            {event.isPublic && (
              <span className="event-list__badge">Public</span>
            )}
          </div>
          <button
            className="event-list__delete"
            onClick={(e) => handleDelete(event, e)}
            aria-label="Delete event"
          >
            <XMarkIcon className="w-5 h-5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

EventList.propTypes = {
  events: PropTypes.array,
  onEdit: PropTypes.func,
  emptyMessage: PropTypes.string,
};
