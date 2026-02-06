import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import EventModal from './EventModal';
import EventList from './EventList';
import MeetingRequests from './MeetingRequests';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import './CalendarView.css';

/**
 * CalendarView - Main calendar component with month view
 */
export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [view, setView] = useState('calendar'); // 'calendar' | 'requests'
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Calculate date range for current view (padded to include full weeks)
  const viewStart = startOfWeek(startOfMonth(currentMonth));
  const viewEnd = endOfWeek(endOfMonth(currentMonth));

  // Fetch events for the visible date range
  const events = useQuery(api.calendar.listEvents, {
    startDate: viewStart.getTime(),
    endDate: viewEnd.getTime(),
  });

  // Get events for a specific day
  const getEventsForDay = (day) => {
    if (!events) return [];
    return events.filter((event) => {
      const eventStart = new Date(event.startTime);
      return isSameDay(eventStart, day);
    });
  };

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    return getEventsForDay(selectedDate);
  }, [events, selectedDate]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    let day = viewStart;

    while (day <= viewEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (day) => {
    setSelectedDate(day);
  };

  const handleDateDoubleClick = (day) => {
    setSelectedDate(day);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
  };

  return (
    <div className="calendar-view">
      <div className="calendar-view__header">
        <div className="calendar-view__nav">
          <h1 className="calendar-view__title">Calendar</h1>
          <div className="calendar-view__tabs">
            <button
              className={`calendar-view__tab ${view === 'calendar' ? 'calendar-view__tab--active' : ''}`}
              onClick={() => setView('calendar')}
            >
              Calendar
            </button>
            <button
              className={`calendar-view__tab ${view === 'requests' ? 'calendar-view__tab--active' : ''}`}
              onClick={() => setView('requests')}
            >
              Meeting Requests
            </button>
          </div>
        </div>
        <button
          className="btn btn--primary calendar-view__schedule-btn"
          onClick={() => setShowScheduleModal(true)}
        >
          📅 Schedule Meeting
        </button>
      </div>

      {view === 'calendar' ? (
        <div className="calendar-view__content">
          <div className="calendar-view__main">
            <div className="calendar-view__controls">
              <div className="calendar-view__month-nav">
                <button 
                  className="calendar-view__nav-btn"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <h2 className="calendar-view__month">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button 
                  className="calendar-view__nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <button 
                className="btn btn--secondary calendar-view__today-btn"
                onClick={handleToday}
              >
                Today
              </button>
            </div>

            <div className="calendar-view__grid">
              <div className="calendar-view__weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="calendar-view__weekday">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-view__days">
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`calendar-view__day ${!isCurrentMonth ? 'calendar-view__day--other-month' : ''} ${isSelected ? 'calendar-view__day--selected' : ''} ${isTodayDate ? 'calendar-view__day--today' : ''}`}
                      onClick={() => handleDateClick(day)}
                      onDoubleClick={() => handleDateDoubleClick(day)}
                    >
                      <span className="calendar-view__day-number">
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="calendar-view__day-events">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event._id}
                              className={`calendar-view__event-dot ${event.isAllDay ? 'calendar-view__event-dot--all-day' : ''}`}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="calendar-view__more-events">
                              +{dayEvents.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="calendar-view__sidebar">
            <div className="calendar-view__selected-date">
              <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setEditingEvent(null);
                  setShowEventModal(true);
                }}
              >
                + New Event
              </button>
            </div>
            <EventList
              events={selectedDateEvents}
              onEdit={handleEditEvent}
              emptyMessage="No events on this day"
            />
          </div>
        </div>
      ) : (
        <MeetingRequests />
      )}

      {showEventModal && (
        <EventModal
          event={editingEvent}
          initialDate={selectedDate}
          onClose={handleCloseModal}
        />
      )}

      <ScheduleMeetingModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
      />
    </div>
  );
}
