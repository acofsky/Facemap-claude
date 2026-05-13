import { useState } from 'react';
import { AppLayout, type Tab } from '@/components/AppLayout';
import { HomePage } from './HomePage';
import { PeoplePage } from './PeoplePage';
import { CirclesPage } from './CirclesPage';
import { RecallPage } from './RecallPage';
import { ProfilePage } from './ProfilePage';
import { PersonProfilePage } from './PersonProfilePage';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  if (selectedPersonId) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background">
        <PersonProfilePage personId={selectedPersonId} onBack={() => setSelectedPersonId(null)} />
      </div>
    );
  }

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <HomePage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'people' && <PeoplePage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'circles' && <CirclesPage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'recall' && <RecallPage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'profile' && <ProfilePage />}
    </AppLayout>
  );
};

export default Index;
