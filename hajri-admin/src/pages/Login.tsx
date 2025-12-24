import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  Title,
  Text,
  Button,
  Container,
  Alert,
  Stack,
  Center,
} from "@mantine/core";
import { IconAlertCircle, IconBrandGoogle } from "@tabler/icons-react";
import { supabase, supabaseConfigError } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, setUser, setSession } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!supabase) return;

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        navigate("/");
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, navigate]);

  const signInWithGoogle = async () => {
    if (!supabase) {
      setError(supabaseConfigError || "Supabase is not configured");
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <Center style={{ minHeight: "100vh" }}>
      <Container size={420} w="100%">
        <Paper withBorder shadow="md" p={30} radius="md">
          <Stack gap="lg">
            <div>
              <Title order={2}>HAJRI Admin</Title>
              <Text c="dimmed" size="sm" mt={4}>
                Sign in with Google to continue
              </Text>
            </div>

            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Login failed"
                color="red"
                variant="light"
              >
                <Text size="sm">{error}</Text>
                <Text size="xs" c="dimmed" mt="xs">
                  Check Supabase Auth → URL Configuration and Google provider
                  settings
                </Text>
              </Alert>
            )}

            {supabaseConfigError && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Configuration Error"
                color="red"
                variant="light"
              >
                <Text size="sm">{supabaseConfigError}</Text>
              </Alert>
            )}

            <Button
              leftSection={<IconBrandGoogle size={18} />}
              onClick={signInWithGoogle}
              loading={loading}
              disabled={!supabase}
              fullWidth
              size="md"
              variant="filled"
            >
              Sign in with Google
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Center>
  );
}
