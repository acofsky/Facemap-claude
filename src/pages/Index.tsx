import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { HomePage } from './HomePage';
import { PeoplePage } from './PeoplePage';
import { CirclesPage } from './CirclesPage';
import { ProfilePage } from './ProfilePage';
import { PersonProfilePage } from './PersonProfilePage';

type Tab = 'home' | 'people' | 'circles' | 'profile';

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
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab} onSelectPerson={setSelectedPersonId}>
      {activeTab === 'home' && <HomePage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'people' && <PeoplePage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'circles' && <CirclesPage onSelectPerson={setSelectedPersonId} />}
      {activeTab === 'profile' && <ProfilePage />}
    </AppLayout>
  );
};

export default Index;
