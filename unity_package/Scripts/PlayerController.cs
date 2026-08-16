using UnityEngine;
using System.Collections.Generic;

namespace PizzaReadyTycoon
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float speed = 11.0f;
        [SerializeField] private float rotationSpeed = 14.0f;
        [SerializeField] private Joystick joystick;

        [Header("Stack System")]
        [SerializeField] private Transform stackRoot;
        [SerializeField] private int maxCapacity = 4;
        [SerializeField] private float stackSpacing = 0.28f;
        [SerializeField] private float stackSwayAmount = 0.08f;

        [Header("Current Floor")]
        [SerializeField] private int currentFloor = 1;
        [SerializeField] private float targetFloorY = 0f;

        private CharacterController controller;
        private List<StackItem> carriedItems = new List<StackItem>();
        private Vector3 moveDirection;

        public int CurrentFloor => currentFloor;
        public int CarriedCount => carriedItems.Count;
        public int MaxCapacity => maxCapacity;

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            HandleMovement();
            UpdateStackSway();
            SmoothFloorTransition();
        }

        private void HandleMovement()
        {
            float h = Input.GetAxisRaw("Horizontal");
            float v = Input.GetAxisRaw("Vertical");

            if (joystick != null && joystick.Direction.sqrMagnitude > 0.01f)
            {
                h = joystick.Horizontal;
                v = joystick.Vertical;
            }

            Vector3 input = new Vector3(h, 0f, v).normalized;

            if (input.sqrMagnitude > 0.01f)
            {
                moveDirection = input * speed;
                Quaternion targetRot = Quaternion.LookRotation(input, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotationSpeed * Time.deltaTime);
            }
            else
            {
                moveDirection = Vector3.zero;
            }

            controller.Move(moveDirection * Time.deltaTime);
        }

        public bool AddItem(ItemCategory category, string type, GameObject prefab)
        {
            if (carriedItems.Count >= maxCapacity) return false;

            GameObject itemObj = Instantiate(prefab, stackRoot);
            itemObj.transform.localPosition = new Vector3(0f, carriedItems.Count * stackSpacing, 0f);
            itemObj.transform.localRotation = Quaternion.identity;

            carriedItems.Add(new StackItem(category, type, itemObj));
            return true;
        }

        public StackItem RemoveItem(ItemCategory category, string type = null)
        {
            for (int i = carriedItems.Count - 1; i >= 0; i--)
            {
                if (carriedItems[i].category == category && (string.IsNullOrEmpty(type) || carriedItems[i].type == type))
                {
                    StackItem item = carriedItems[i];
                    carriedItems.RemoveAt(i);
                    Destroy(item.visualObj);
                    RebuildStackPositions();
                    return item;
                }
            }
            return null;
        }

        private void RebuildStackPositions()
        {
            for (int i = 0; i < carriedItems.Count; i++)
            {
                if (carriedItems[i].visualObj != null)
                {
                    carriedItems[i].visualObj.transform.localPosition = new Vector3(0f, i * stackSpacing, 0f);
                }
            }
        }

        private void UpdateStackSway()
        {
            if (stackRoot == null) return;
            float tilt = Mathf.Sin(Time.time * 12f) * (moveDirection.magnitude > 0.1f ? stackSwayAmount : 0f);
            stackRoot.localRotation = Quaternion.Euler(0f, 0f, tilt * Mathf.Rad2Deg);
        }

        public void SetFloor(int floorNumber, float floorHeight)
        {
            currentFloor = floorNumber;
            targetFloorY = floorHeight;
        }

        private void SmoothFloorTransition()
        {
            Vector3 pos = transform.position;
            pos.y = Mathf.Lerp(pos.y, targetFloorY, 8f * Time.deltaTime);
            transform.position = pos;
        }
    }
}
