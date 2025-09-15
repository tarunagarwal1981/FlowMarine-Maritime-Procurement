import { createSlice } from '@reduxjs/toolkit';

interface NotificationState {
  unreadCount: number;
}

const initialState: NotificationState = {
  unreadCount: 0
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    }
  }
});

export const { setUnreadCount } = notificationSlice.actions;
export const selectUnreadCount = (state: any) => state.notification.unreadCount;
export default notificationSlice.reducer;