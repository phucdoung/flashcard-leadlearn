import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '../context/AuthContext';
import { PresenceProvider } from '../context/PresenceContext';
import ProtectedRoute from '../components/ProtectedRoute';

import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import ResetPassword from '../pages/Auth/ResetPassword';
import Home from '../pages/Home/Home';
import Statistics from '../pages/Statistics/Statistics';
import Community from '../pages/Community/Community';
import PublicProfile from '../pages/Community/PublicProfile';
import FlashcardSetDetail from '../pages/Flashcard/FlashcardSetDetail';
import StudyFlashcard from '../pages/Flashcard/StudyFlashcard';
import CreateQuiz from '../pages/Quiz/CreateQuiz';
import Quiz from '../pages/Quiz/Quiz';
import QuizResult from '../pages/Quiz/QuizResult';
import Profile from '../pages/Profile/Profile';

export default function AppRoutes() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth routes wrapped in AuthLayout */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Main app routes wrapped in MainLayout & ProtectedRoute */}
            <Route element={<MainLayout />}>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Navigate to="/community" replace />} />
                <Route path="/community" element={<Community />} />
                <Route path="/users/:id" element={<PublicProfile />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/flashcard/:id" element={<FlashcardSetDetail />} />
                <Route path="/study/:id" element={<StudyFlashcard />} />
                <Route path="/flashcard/:id/study" element={<StudyFlashcard />} />
                <Route path="/quiz/create/:id" element={<CreateQuiz />} />
                <Route path="/quiz/:id" element={<Quiz />} />
                <Route path="/result/:id" element={<QuizResult />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </PresenceProvider>
    </AuthProvider>
  );
}
