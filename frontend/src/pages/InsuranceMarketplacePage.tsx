import React from 'react';
import { PolicyPlanManager } from '../components/AdminPolicyPlans';
import { useAuth } from '../context/useAuth';

export const InsuranceMarketplacePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PolicyPlanManager
        audience="insurance_agent"
        companyName={user?.insuranceDetails?.companyName}
      />
    </main>
  );
};
