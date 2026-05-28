import { createSlice } from '@reduxjs/toolkit';

const user = JSON.parse(localStorage.getItem('tp_user') || 'null');
const token = localStorage.getItem('tp_token') || null;

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user,
    token,
    isAuthenticated: !!token,
  },
  reducers: {
    loginSuccess(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.accessToken;
      state.isAuthenticated = true;
      localStorage.setItem('tp_user', JSON.stringify(action.payload.user));
      localStorage.setItem('tp_token', action.payload.accessToken);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('tp_user');
      localStorage.removeItem('tp_token');
    },
    updateUser(state, action) {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('tp_user', JSON.stringify(state.user));
    }
  }
});

export const { loginSuccess, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
