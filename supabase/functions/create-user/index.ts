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

    // Try to create auth user, or find existing one if email already registered
    let authUserId: string
    let existingAuthUser = false

    // First, try to create a new auth user
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
      },
    })

    if (authCreateError) {
      // Check if error is because user already exists
      if (authCreateError.message.includes('already been registered') ||
          authCreateError.message.includes('User already registered')) {
        console.log('Auth user already exists, looking up and linking:', email)

        // Find existing auth user by email
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const foundUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

        if (!foundUser) {
          throw new Error('User email exists but could not be found in auth system')
        }

        authUserId = foundUser.id
        existingAuthUser = true

        // Update user metadata to include staff info
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...foundUser.user_metadata,
            first_name,
            last_name,
          },
        })
      } else {
        // Some other auth error
        throw new Error('Failed to create auth user: ' + authCreateError.message)
      }
    } else {
      // Successfully created new auth user
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
