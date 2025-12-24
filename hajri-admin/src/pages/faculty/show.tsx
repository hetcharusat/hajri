import { Show, TextField, EmailField } from "@refinedev/mantine";
import { Title, Text, Badge } from "@mantine/core";
import { useShow } from "@refinedev/core";

export const FacultyShow = () => {
  const { queryResult } = useShow({
    resource: "faculty",
    meta: {
      select: "*, departments(name, code)",
    },
  });

  const { data, isLoading } = queryResult;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Title my="xs" order={5}>
        Name
      </Title>
      <Text mt="sm">{record?.name}</Text>

      <Title my="xs" order={5} mt="lg">
        Email
      </Title>
      <EmailField value={record?.email || "—"} />

      <Title my="xs" order={5} mt="lg">
        Abbreviation
      </Title>
      {record?.abbr ? (
        <Badge color="blue" variant="light">
          {record.abbr}
        </Badge>
      ) : (
        <Text c="dimmed">—</Text>
      )}

      <Title my="xs" order={5} mt="lg">
        Department
      </Title>
      <Text mt="sm">{record?.departments?.name || "—"}</Text>
    </Show>
  );
};
