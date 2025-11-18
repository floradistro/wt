import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: ' + (authError?.message || 'Invalid token') }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { email, first_name, last_name, phone, role, employee_id } = await req.json()

    // Get current user's vendor_id
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('vendor_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (userError) {
      throw new Error('Failed to get current user: ' + userError.message)
    }

    // Check if current user has permission to create users (vendor_owner or vendor_admin)
    if (currentUser.role !== 'vendor_owner' && currentUser.role !== 'vendor_admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if auth user already exists (e.g., as a customer)
    let authUserId: string

    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === email)

    if (existingAuthUser) {
      console.log('Auth user already exists, linking to staff record:', email)
      authUserId = existingAuthUser.id

      // Update user metadata to include staff info
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          ...existingAuthUser.user_metadata,
          first_name,
          last_name,
        },
      })
    } else {
      // Create new user in Supabase Auth
      const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
        },
      })

      if (authCreateError) {
        throw new Error('Failed to create auth user: ' + authCreateError.message)
      }

      authUserId = authData.user.id
    }

    // Check if staff record already exists for this vendor
    const { data: existingStaffUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .eq('vendor_id', currentUser.vendor_id)
      .single()

    if (existingStaffUser) {
      throw new Error('This user is already a staff member for your organization')
    }

    // Create user record in database
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        first_name,
        last_name,
        phone: phone || null,
        role,
        employee_id: employee_id || null,
        vendor_id: currentUser.vendor_id,
        auth_user_id: authUserId,
        status: 'active',
      })
      .select()
      .single()

    if (insertError) {
      // If database insert fails and we created a new auth user, delete it
      if (!existingAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
      }
      throw new Error('Failed to create user record: ' + insertError.message)
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
