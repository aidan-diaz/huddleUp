import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isBefore,
  isToday,
  setHours,
  setMinutes,
} from 'date-fns';
import PropTypes from 'prop-types';
import UserPresence from '../common/UserPresence';
import LoadingSpinner from '../common/LoadingSpinner';
import './ScheduleMeetingModal.css';

/**
 * ScheduleMeetingModal - Schedule meetings with other users
 * Shows side-by-side calendar view and meeting request form
 */
export default function ScheduleMeetingModal({
  isOpen,
  onClose,
  recipientId: initialRecipientId,
  recipientName: initialRecipientName,
}) {
  // User selection state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(
    initialRecipientId
      ? { _id: initialRecipientId, name: initialRecipientName }
      : null
  );

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Queries
  const searchResults = useQuery(
    api.users.searchUsers,
    searchTerm.length >= 2 ? { searchTerm, limit: 10 } : 'skip'
  );

  // My events for selected date
  const myEvents = useQuery(api.calendar.listEvents, {
    startDate: startOfDay(selectedDate).getTime(),
    endDate: endOfDay(selectedDate).getTime(),
  });

  // Their public events for selected date
  const theirEvents = useQuery(
    api.calendar.getPublicCalendar,
    selectedUser?._id
      ? {
          userId: selectedUser._id,
          startDate: startOfDay(selectedDate).getTime(),
          endDate: endOfDay(selectedDate).getTime(),
        }
      : 'skip'
  );

  // Mutation
  const requestMeeting = useMutation(api.calendar.requestMeeting);

  // Generate time slots for display (7am to 9pm in 30min increments)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 7; hour <= 21; hour++) {
      slots.push({ hour, minute: 0, label: format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a') });
      if (hour < 21) {
        slots.push({ hour, minute: 30, label: format(setHours(setMinutes(new Date(), 30), hour), 'h:30 a') });
      }
    }
    return slots;
  }, []);

  // Check if a time slot overlaps with any events
  const isSlotBusy = (events, hour, minute) => {
    if (!events) return false;
    const slotTime = setHours(setMinutes(selectedDate, minute), hour).getTime();
    const slotEnd = slotTime + 30 * 60 * 1000; // 30 minutes

    return events.some((event) => {
      const eventStart = event.startTime;
      const eventEnd = event.endTime;
      return slotTime < eventEnd && slotEnd > eventStart;
    });
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchTerm('');
    setError(null);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setSearchTerm('');
  };

  const handleDateChange = (days) => {
    setSelectedDate((prev) => {
      const newDate = days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days));
      // Don't allow navigating to past dates
      if (isBefore(startOfDay(newDate), startOfDay(new Date()))) {
        return prev;
      }
      return newDate;
    });
  };

  // Check if we can go to previous day
  const canGoPrevious = !isToday(selectedDate);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedUser) {
      setError('Please select a person to meet with');
      return;
    }

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setIsSubmitting(true);

      // Parse times
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);

      const proposedStartTime = setHours(
        setMinutes(selectedDate, startMin),
        startHour
      ).getTime();
      const proposedEndTime = setHours(
        setMinutes(selectedDate, endMin),
        endHour
      ).getTime();

      if (proposedEndTime <= proposedStartTime) {
        setError('End time must be after start time');
        setIsSubmitting(false);
        return;
      }

      // Check if the meeting time is in the past
      if (proposedStartTime < Date.now()) {
        setError('Cannot schedule a meeting in the past');
        setIsSubmitting(false);
        return;
      }

      await requestMeeting({
        recipientId: selectedUser._id,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        proposedStartTime,
        proposedEndTime,
      });

      setSuccess(true);
      // Reset form
      setFormData({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
      });

      // Close after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error requesting meeting:', err);
      setError(err.message || 'Failed to send meeting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal schedule-meeting-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2>Schedule Meeting</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal__body schedule-meeting-modal__body">
          {success ? (
            <div className="schedule-meeting-modal__success">
              <span className="schedule-meeting-modal__success-icon">✓</span>
              <p>Meeting request sent!</p>
              <p className="schedule-meeting-modal__success-subtitle">
                {selectedUser?.name || 'They'} will receive your request.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="schedule-meeting-modal__error">{error}</div>
              )}

              {/* User Selection */}
              <div className="schedule-meeting-modal__section">
                <label className="schedule-meeting-modal__label">
                  Meet with
                </label>
                {selectedUser ? (
                  <div className="schedule-meeting-modal__selected-user">
                    <div className="schedule-meeting-modal__user-info">
                      <div className="schedule-meeting-modal__avatar">
                        {selectedUser.avatarUrl ? (
                          <img src={selectedUser.avatarUrl} alt="" />
                        ) : (
                          <span>
                            {selectedUser.name?.[0] ||
                              selectedUser.email?.[0] ||
                              '?'}
                          </span>
                        )}
                      </div>
                      <span>{selectedUser.name || selectedUser.email}</span>
                    </div>
                    {!initialRecipientId && (
                      <button
                        type="button"
                        className="schedule-meeting-modal__clear-user"
                        onClick={handleClearUser}
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="schedule-meeting-modal__user-search">
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                    {searchTerm.length >= 2 && (
                      <div className="schedule-meeting-modal__search-results">
                        {searchResults === undefined ? (
                          <div className="schedule-meeting-modal__search-loading">
                            <LoadingSpinner />
                          </div>
                        ) : searchResults.length === 0 ? (
                          <p className="schedule-meeting-modal__search-empty">
                            No users found
                          </p>
                        ) : (
                          <ul>
                            {searchResults.map((user) => (
                              <li key={user._id}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectUser(user)}
                                >
                                  <div className="schedule-meeting-modal__avatar">
                                    {user.avatarUrl ? (
                                      <img src={user.avatarUrl} alt="" />
                                    ) : (
                                      <span>
                                        {user.name?.[0] || user.email[0]}
                                      </span>
                                    )}
                                    <UserPresence
                                      status={user.presenceStatus}
                                      size="small"
                                    />
                                  </div>
                                  <div className="schedule-meeting-modal__user-details">
                                    <span className="schedule-meeting-modal__user-name">
                                      {user.name || user.email}
                                    </span>
                                    {user.name && (
                                      <span className="schedule-meeting-modal__user-email">
                                        {user.email}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date Navigation */}
              <div className="schedule-meeting-modal__section">
                <label className="schedule-meeting-modal__label">Date</label>
                <div className="schedule-meeting-modal__date-nav">
                  <button
                    type="button"
                    onClick={() => handleDateChange(-1)}
                    className="schedule-meeting-modal__date-btn"
                    disabled={!canGoPrevious}
                  >
                    ‹
                  </button>
                  <span className="schedule-meeting-modal__date">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    {isToday(selectedDate) && <span className="schedule-meeting-modal__today-badge">Today</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDateChange(1)}
                    className="schedule-meeting-modal__date-btn"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Side-by-side Calendar View */}
              {selectedUser && (
                <div className="schedule-meeting-modal__calendars">
                  <div className="schedule-meeting-modal__calendar">
                    <h4>Your Schedule</h4>
                    <div className="schedule-meeting-modal__time-grid">
                      {timeSlots.map(({ hour, minute, label }) => {
                        const isBusy = isSlotBusy(myEvents, hour, minute);
                        return (
                          <div
                            key={`my-${hour}-${minute}`}
                            className={`schedule-meeting-modal__time-slot ${isBusy ? 'schedule-meeting-modal__time-slot--busy' : 'schedule-meeting-modal__time-slot--free'}`}
                          >
                            <span className="schedule-meeting-modal__time-label">
                              {label}
                            </span>
                            <span className="schedule-meeting-modal__slot-status">
                              {isBusy ? 'Busy' : 'Free'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="schedule-meeting-modal__calendar">
                    <h4>{selectedUser.name || 'Their'} Schedule</h4>
                    <div className="schedule-meeting-modal__time-grid">
                      {timeSlots.map(({ hour, minute, label }) => {
                        const isBusy = isSlotBusy(theirEvents, hour, minute);
                        return (
                          <div
                            key={`their-${hour}-${minute}`}
                            className={`schedule-meeting-modal__time-slot ${isBusy ? 'schedule-meeting-modal__time-slot--busy' : 'schedule-meeting-modal__time-slot--free'}`}
                          >
                            <span className="schedule-meeting-modal__time-label">
                              {label}
                            </span>
                            <span className="schedule-meeting-modal__slot-status">
                              {isBusy ? 'Busy' : 'Free'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Meeting Details Form */}
              <form onSubmit={handleSubmit}>
                <div className="schedule-meeting-modal__section">
                  <label
                    className="schedule-meeting-modal__label"
                    htmlFor="meeting-title"
                  >
                    Meeting Title *
                  </label>
                  <input
                    type="text"
                    id="meeting-title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g., Project sync, Coffee chat"
                    required
                  />
                </div>

                <div className="schedule-meeting-modal__section">
                  <label
                    className="schedule-meeting-modal__label"
                    htmlFor="meeting-description"
                  >
                    Description (optional)
                  </label>
                  <textarea
                    id="meeting-description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Add details about the meeting..."
                    rows={2}
                  />
                </div>

                <div className="schedule-meeting-modal__time-inputs">
                  <div className="schedule-meeting-modal__section">
                    <label
                      className="schedule-meeting-modal__label"
                      htmlFor="start-time"
                    >
                      Start Time
                    </label>
                    <input
                      type="time"
                      id="start-time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="schedule-meeting-modal__section">
                    <label
                      className="schedule-meeting-modal__label"
                      htmlFor="end-time"
                    >
                      End Time
                    </label>
                    <input
                      type="time"
                      id="end-time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="modal__footer">
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
                    disabled={isSubmitting || !selectedUser}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

ScheduleMeetingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  recipientId: PropTypes.string,
  recipientName: PropTypes.string,
};
