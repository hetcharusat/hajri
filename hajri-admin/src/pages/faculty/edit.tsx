import { Edit, useForm } from "@refinedev/mantine";
import { TextInput, Select } from "@mantine/core";
import { useSelect } from "@refinedev/mantine";

export const FacultyEdit = () => {
  const {
    getInputProps,
    saveButtonProps,
    refineCore: { queryResult, formLoading },
  } = useForm({
    initialValues: {
      name: "",
      email: "",
      abbr: "",
      department_id: null,
    },
    refineCoreProps: {
      resource: "faculty",
      action: "edit",
    },
  });

  const { selectProps: departmentSelectProps } = useSelect({
    resource: "departments",
    optionLabel: "name",
    optionValue: "id",
    defaultValue: queryResult?.data?.data?.department_id,
  });

  return (
    <Edit isLoading={formLoading} saveButtonProps={saveButtonProps}>
      <TextInput
        mt="sm"
        label="Name"
        placeholder="Dr. John Smith"
        {...getInputProps("name")}
        required
      />
      <TextInput
        mt="sm"
        label="Email"
        placeholder="john.smith@university.edu"
        type="email"
        {...getInputProps("email")}
      />
      <TextInput
        mt="sm"
        label="Abbreviation"
        placeholder="JS"
        {...getInputProps("abbr")}
      />
      <Select
        mt="sm"
        label="Department"
        placeholder="Select department"
        {...getInputProps("department_id")}
        data={departmentSelectProps.data || []}
      />
    </Edit>
  );
};
