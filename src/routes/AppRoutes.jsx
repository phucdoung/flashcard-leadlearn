import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '../context/AuthContext';
import { PresenceProvider } from '../context/PresenceContext';
import ProtectedRoute from '../components/ProtectedRoute';

import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

import Login from '../views/Auth/Login';
import Register from '../views/Auth/Register';
import ForgotPassword from '../views/Auth/ForgotPassword';
import ResetPassword from '../views/Auth/ResetPassword';
import Home from '../views/Home/Home';
import DecksPage from '../views/Decks/DecksPage';
import Statistics from '../views/Statistics/Statistics';
import Community from '../views/Community/Community';
import PublicProfile from '../views/Community/PublicProfile';
import FlashcardSetDetail from '../views/Flashcard/FlashcardSetDetail';
import StudyFlashcard from '../views/Flashcard/StudyFlashcard';
import CreateQuiz from '../views/Quiz/CreateQuiz';
import Quiz from '../views/Quiz/Quiz';
import QuizResult from '../views/Quiz/QuizResult';
import Profile from '../views/Profile/Profile';

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
                <Route path="/decks" element={<DecksPage />} />
                <Route path="/flashcard" element={<DecksPage />} />
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
                <Route path="/quiz/result/:id" element={<QuizResult />} />
                <Route path="/quiz/:id/result" element={<QuizResult />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </PresenceProvider>
    </AuthProvider>
  );
}
