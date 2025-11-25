import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const results: any = {};
  
  // Check environment variables
  results.env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
    ASTER_API_KEY: process.env.ASTER_API_KEY ? '✅ Set' : '❌ Missing',
    ASTER_API_SECRET: process.env.ASTER_API_SECRET ? '✅ Set' : '❌ Missing',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing',
  };

  // Try to connect with service role
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data: models, error } = await supabase
        .from('models')
        .select('id, name, status, api_model')
        .eq('status', 'active');
      
      if (error) {
        results.database = {
          status: '❌ Error',
          error: error.message,
          code: error.code
        };
      } else {
        results.database = {
          status: '✅ Connected',
          activeModels: models?.length || 0,
          models: models?.map(m => `${m.name} (${m.status})`)
        };
      }
    } catch (err) {
      results.database = {
        status: '❌ Connection failed',
        error: String(err)
      };
    }
  } else {
    results.database = {
      status: '❌ Missing credentials'
    };
  }

  return NextResponse.json(results, { status: 200 });
}