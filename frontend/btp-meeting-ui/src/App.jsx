import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Intro from './components/Intro';
import MainArea from './components/MainArea';
import RecordingList from './components/RecordingList';
import { fetchRecordings } from './api';

export default function App() {
  const [recordings, setRecordings] = useState([]);

  useEffect(() => {
        fetchRecordings()
          .then(setRecordings)
          .catch(err => {
            console.error("fetchRecordings failed:", err);
            // on part sur une liste vide plutôt que de planter
            setRecordings([]);
          });
      }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Intro />
      <MainArea onNewRecording={recs => setRecordings(recs)} />
      <RecordingList recordings={recordings} />
    </div>
  );
}
