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
    const { action, userId, password } = await req.json()

    // Get current user's role and vendor_id
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('vendor_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (userError) {
      throw new Error('Failed to get current user: ' + userError.message)
    }

    // Check if current user has permission to manage users (vendor_owner or vendor_admin)
    if (currentUser.role !== 'vendor_owner' && currentUser.role !== 'vendor_admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle different actions
    if (action === 'set-password') {
      // Get the user's auth_user_id
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, vendor_id')
        .eq('id', userId)
        .single()

      if (targetUserError) {
        throw new Error('Failed to get target user: ' + targetUserError.message)
      }

      // Verify target user belongs to same vendor
      if (targetUser.vendor_id !== currentUser.vendor_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot manage users from other vendors' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!targetUser.auth_user_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'User has no auth account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update password via Supabase Auth Admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.auth_user_id,
        { password }
      )

      if (updateError) {
        throw new Error('Failed to update password: ' + updateError.message)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (action === 'delete-user') {
      // Get the user's auth_user_id before deleting
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, vendor_id')
        .eq('id', userId)
        .single()

      if (targetUserError) {
        throw new Error('Failed to get target user: ' + targetUserError.message)
      }

      // Verify target user belongs to same vendor
      if (targetUser.vendor_id !== currentUser.vendor_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot manage users from other vendors' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Delete from users table (cascade will handle user_locations)
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId)

      if (deleteError) {
        throw new Error('Failed to delete user: ' + deleteError.message)
      }

      // Delete from auth if auth_user_id exists
      if (targetUser.auth_user_id) {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
          targetUser.auth_user_id
        )

        if (authDeleteError) {
          console.error('Failed to delete auth user:', authDeleteError)
          // Continue anyway - database record is already deleted
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
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
