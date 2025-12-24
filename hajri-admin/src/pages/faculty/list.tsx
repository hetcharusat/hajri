import { useList } from "@refinedev/core";
import { List, EditButton, ShowButton, DeleteButton } from "@refinedev/mantine";
import { Table, Group, Badge, Text, LoadingOverlay, Box } from "@mantine/core";

export const FacultyList = () => {
  const { data, isLoading } = useList({
    resource: "faculty",
  });

  const facultyData = data?.data || [];

  return (
    <List>
      <Box pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Abbreviation</Table.Th>
              <Table.Th>Department</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {facultyData.map((faculty: any) => (
              <Table.Tr key={faculty.id}>
                <Table.Td>{faculty.name}</Table.Td>
                <Table.Td>{faculty.email}</Table.Td>
                <Table.Td>
                  {faculty.abbr ? (
                    <Badge color="blue" variant="light">
                      {faculty.abbr}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {faculty.departments?.name || <Text size="sm" c="dimmed">—</Text>}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <ShowButton hideText recordItemId={faculty.id} size="sm" />
                    <EditButton hideText recordItemId={faculty.id} size="sm" />
                    <DeleteButton hideText recordItemId={faculty.id} size="sm" />
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </List>
  );
};
