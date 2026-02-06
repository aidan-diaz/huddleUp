import { useState, useCallback, createContext, useContext } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * Call context for managing active calls across the app
 */
const CallContext = createContext(null);

/**
 * CallProvider component - Wraps app to provide call functionality
 */
export function CallProvider({ children }) {
  const [activeCall, setActiveCall] = useState(null);
  
  // Query for any active call the user is in
  const currentCall = useQuery(api.calls.getActiveCall);
  
  // Actions
  const createCallAction = useAction(api.calls.createCall);
  const joinCallAction = useAction(api.calls.joinCall);
  const leaveCallMutation = useMutation(api.calls.leaveCall);
  const endCallMutation = useMutation(api.calls.endCall);

  /**
   * Start a new call (either to a conversation or group)
   */
  const startCall = useCallback(async ({ conversationId, groupId, type }) => {
    try {
      const result = await createCallAction({ conversationId, groupId, type });
      setActiveCall({
        callId: result.callId,
        token: result.token,
        roomName: result.roomName,
        callType: type,
      });
      return result;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }, [createCallAction]);

  /**
   * Join an existing call
   */
  const joinCall = useCallback(async (callId, callType) => {
    try {
      const result = await joinCallAction({ callId });
      setActiveCall({
        callId,
        token: result.token,
        roomName: result.roomName,
        callType,
      });
      return result;
    } catch (error) {
      console.error('Error joining call:', error);
      throw error;
    }
  }, [joinCallAction]);

  /**
   * Leave the current call
   */
  const leaveCall = useCallback(async () => {
    if (!activeCall?.callId) return;
    
    try {
      await leaveCallMutation({ callId: activeCall.callId });
      setActiveCall(null);
    } catch (error) {
      console.error('Error leaving call:', error);
      // Still clear active call on error
      setActiveCall(null);
    }
  }, [activeCall, leaveCallMutation]);

  /**
   * End the call for everyone
   */
  const endCall = useCallback(async () => {
    if (!activeCall?.callId) return;
    
    try {
      await endCallMutation({ callId: activeCall.callId });
      setActiveCall(null);
    } catch (error) {
      console.error('Error ending call:', error);
      setActiveCall(null);
    }
  }, [activeCall, endCallMutation]);

  /**
   * Set active call (used when answering incoming call)
   */
  const setCall = useCallback((callData) => {
    setActiveCall(callData);
  }, []);

  /**
   * Clear active call
   */
  const clearCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const value = {
    activeCall,
    currentCall,
    isInCall: !!activeCall,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    setCall,
    clearCall,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

/**
 * useCall hook - Access call context
 */
export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export default useCall;
